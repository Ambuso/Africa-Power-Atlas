import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { analyseSite, validateSiteSpec, type SiteIndex, type SiteSpec } from './site-check';

let indexPromise: Promise<SiteIndex> | undefined;
export function loadSiteIndex(): Promise<SiteIndex> {
  if (!indexPromise) indexPromise = readFile(path.join(process.cwd(), '.generated/site-check/index.json'), 'utf8').then((text) => JSON.parse(text) as SiteIndex).catch((error) => { indexPromise = undefined; throw error; });
  return indexPromise;
}

export class SiteCheckRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function readSiteRequest(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get('origin');
  if (origin) {
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || new URL(request.url).host;
    const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '');
    let sameOrigin = false;
    try { const source = new URL(origin); sameOrigin = source.host === host && source.protocol === protocol + ':'; } catch {}
    if (!sameOrigin) throw new SiteCheckRequestError('Submit this request from the MapKwetu website.', 403);
  }
  if (!request.headers.get('content-type')?.includes('application/json')) throw new SiteCheckRequestError('Send a JSON request.', 415);
  const reader = request.body?.getReader(); if (!reader) throw new SiteCheckRequestError('The request is empty.', 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8192) { await reader.cancel(); throw new SiteCheckRequestError('The request is too large.', 413); } chunks.push(value); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; } catch { throw new SiteCheckRequestError('The request could not be read.', 400); }
}

// Best-effort per-instance throttling. It is not a distributed rate limit.
const attempts = new Map<string, { count: number; until: number }>();
export function throttleSiteRequest(request: Request, purpose: string, maximum: number) {
  const now = Date.now(); const key = createHash('sha256').update(`${purpose}:${request.headers.get('x-forwarded-for') || 'anonymous'}`).digest('hex');
  if (attempts.size > 1000) for (const [id, entry] of attempts) if (entry.until < now) attempts.delete(id);
  if (attempts.size >= 10000 && !attempts.has(key)) throw new SiteCheckRequestError('Please try again later.', 429);
  const entry = attempts.get(key); const current = !entry || entry.until < now ? { count: 0, until: now + 600000 } : entry;
  current.count++; attempts.set(key, current);
  if (current.count > maximum) throw new SiteCheckRequestError('Too many checks in a short period. Please try again later.', 429);
}

export interface LeadStorageConfig { blobToken?: string; supabaseUrl?: string; supabaseKey?: string; reportSecret?: string }
export function leadStorageConfig(): LeadStorageConfig {
  return { blobToken: process.env.BLOB_READ_WRITE_TOKEN, supabaseUrl: process.env.SUPABASE_URL, supabaseKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, reportSecret: process.env.SITE_CHECK_REPORT_SECRET };
}
export function storageEnabled(config: LeadStorageConfig): boolean { return !!config.blobToken || !!(config.supabaseUrl && config.supabaseKey); }
function secret(config: LeadStorageConfig): string { const key = config.reportSecret || config.blobToken || config.supabaseKey; if (!key) throw new SiteCheckRequestError('PDF sign-ups are not enabled yet.', 503); return key; }
interface ReportGrant { site: SiteSpec; reportId: string; version: string; expires: number }
export function signReportGrant(site: SiteSpec, reportId: string, version: string, config: LeadStorageConfig, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ site, reportId, version, expires: now + 15 * 60000 })).toString('base64url');
  return body + '.' + createHmac('sha256', secret(config)).update('mapkwetu-site-report-v1:' + body).digest('base64url');
}
export function verifyReportGrant(token: unknown, config: LeadStorageConfig, now = Date.now()): ReportGrant {
  if (typeof token !== 'string' || token.length > 4000) throw new SiteCheckRequestError('Run a fresh Site Check before downloading.', 400);
  const [body, signature, extra] = token.split('.'); if (!body || !signature || extra) throw new SiteCheckRequestError('The report request is invalid.', 400);
  const expected = createHmac('sha256', secret(config)).update('mapkwetu-site-report-v1:' + body).digest(); const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new SiteCheckRequestError('The report request is invalid. Run a fresh check.', 400);
  try {
    const grant = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ReportGrant;
    if (!grant.reportId || !grant.version || !Number.isFinite(grant.expires) || grant.expires < now || grant.expires > now + 16 * 60000) throw new Error();
    grant.site = validateSiteSpec(grant.site); return grant;
  } catch { throw new SiteCheckRequestError('This report request has expired. Run a fresh Site Check.', 400); }
}

export interface SiteCheckLead {
  id: string; email: string; email_verified: false; created_at: string; report_id: string;
  site: SiteSpec; dataset_version: string; consent_version: string; consent: true;
  marketing_consent: boolean; expert_verification_requested: boolean;
}

export async function persistSiteCheckLead(lead: SiteCheckLead, config: LeadStorageConfig, transport: typeof fetch = fetch): Promise<void> {
  if (config.blobToken) {
    // Versioned private upload protocol used by the Vercel Blob SDK. No public
    // fallback is allowed, and the returned private URL is never sent to clients.
    const storeId = config.blobToken.split('_')[3]; if (!storeId) throw new SiteCheckRequestError('Report sign-ups are temporarily unavailable.', 503);
    const url = new URL('https://vercel.com/api/blob/'); url.searchParams.set('pathname', `site-check-leads/${lead.id}.json`);
    const response = await transport(url, { method: 'PUT', headers: { Authorization: `Bearer ${config.blobToken}`, 'x-api-version': '13', 'x-vercel-blob-access': 'private', 'x-vercel-blob-store-id': storeId, 'x-content-type': 'application/json', 'x-add-random-suffix': '0', 'x-allow-overwrite': '1', 'x-api-blob-request-id': randomUUID(), 'x-api-blob-request-attempt': '0' }, body: JSON.stringify(lead), signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new SiteCheckRequestError('Your enquiry could not be saved. Please try again shortly.', 503);
    const stored = await response.json() as { url?: string };
    if (!stored.url || !new URL(stored.url).hostname.endsWith('.private.blob.vercel-storage.com')) throw new SiteCheckRequestError('Private report sign-ups are temporarily unavailable.', 503);
    return;
  }
  if (config.supabaseUrl && config.supabaseKey) {
    const url = new URL('/rest/v1/mapkwetu_site_check_leads?on_conflict=id', config.supabaseUrl);
    if (url.protocol !== 'https:') throw new SiteCheckRequestError('Report sign-ups are temporarily unavailable.', 503);
    const headers: Record<string, string> = { apikey: config.supabaseKey, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' };
    if (config.supabaseKey.startsWith('eyJ')) headers.Authorization = `Bearer ${config.supabaseKey}`;
    const response = await transport(url, { method: 'POST', headers, body: JSON.stringify(lead), signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new SiteCheckRequestError('Your enquiry could not be saved. Please try again shortly.', 503);
    return;
  }
  throw new SiteCheckRequestError('PDF sign-ups are not enabled yet. Your on-screen summary remains available.', 503);
}

export function siteCheckError(error: unknown): Response {
  const known = error instanceof SiteCheckRequestError;
  if (!known) console.error('Site Check failed:', error instanceof Error ? error.message : 'Unexpected error');
  return Response.json({ error: known ? error.message : 'The check could not be completed. Please try again shortly.' }, { status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
}
export function checkedReport(spec: SiteSpec, index: SiteIndex, full = false) { const report = analyseSite(spec, index, full ? 10 : 3); report.id = randomUUID(); return report; }
