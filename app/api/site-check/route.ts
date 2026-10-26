import { validateSiteSpec } from '@/lib/site-check';
import { checkedReport, leadStorageConfig, loadSiteIndex, readSiteRequest, signReportGrant, siteCheckError, SiteCheckRequestError, storageEnabled, throttleSiteRequest } from '@/lib/site-check-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const input = await readSiteRequest(request); throttleSiteRequest(request, 'summary', 30);
    let site; try { site = validateSiteSpec(input); } catch (error) { throw new SiteCheckRequestError(error instanceof Error ? error.message : 'Choose a valid site.', 400); }
    const report = checkedReport(site, await loadSiteIndex()); const config = leadStorageConfig(); const pdfAvailable = storageEnabled(config);
    return Response.json({ report, pdfAvailable, downloadToken: pdfAvailable ? signReportGrant(site, report.id, report.version, config) : null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return siteCheckError(error); }
}
