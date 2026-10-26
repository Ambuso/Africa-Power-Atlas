import { createHash } from 'node:crypto';
import { createSiteCheckPdf } from '@/lib/site-check-pdf';
import { checkedReport, leadStorageConfig, loadSiteIndex, persistSiteCheckLead, readSiteRequest, siteCheckError, SiteCheckRequestError, storageEnabled, throttleSiteRequest, verifyReportGrant, type SiteCheckLead } from '@/lib/site-check-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const input = await readSiteRequest(request); throttleSiteRequest(request, 'pdf', 8);
    if (input.company) throw new SiteCheckRequestError('The request could not be completed.', 400);
    if (typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || input.consent !== true) throw new SiteCheckRequestError('Enter an email address and agree to store this report enquiry.', 400);
    const config = leadStorageConfig(); if (!storageEnabled(config)) throw new SiteCheckRequestError('PDF sign-ups are not enabled yet. Your on-screen summary remains available.', 503);
    const grant = verifyReportGrant(input.token, config); const index = await loadSiteIndex();
    if (grant.version !== index.version) throw new SiteCheckRequestError('The data has changed. Run a fresh Site Check for the latest snapshot.', 409);
    const report = checkedReport(grant.site, index, true); report.id = grant.reportId; const pdf = createSiteCheckPdf(report);
    const email = input.email.trim().toLowerCase();
    const lead: SiteCheckLead = { id: createHash('sha256').update(`${grant.reportId}:${email}`).digest('hex'), email, email_verified: false, created_at: new Date().toISOString(), report_id: grant.reportId, site: grant.site, dataset_version: index.version, consent_version: 'site-check-report-v1', consent: true, marketing_consent: input.marketingConsent === true, expert_verification_requested: input.expertVerification === true };
    await persistSiteCheckLead(lead, config);
    return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="mapkwetu-site-check.pdf"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return siteCheckError(error); }
}
