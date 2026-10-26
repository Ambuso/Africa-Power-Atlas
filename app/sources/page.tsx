import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/marketing/Brand';
import { DATA_SOURCES } from '@/lib/dataSources';

export const metadata: Metadata = {
  title: 'Sources & methodology · MapKwetu',
  description: 'Understand the public datasets, coverage, and limits behind the MapKwetu Africa infrastructure atlas.',
};

export default function SourcesPage() {
  return (
    <main className="kw-site"><SiteHeader />
      <section className="kw-sources" aria-labelledby="sources-title">
        <p className="kw-eyebrow">SOURCES & METHODOLOGY</p>
        <h1 id="sources-title">A clearer picture includes<br />the things we don’t know.</h1>
        <p className="kw-sources-intro">MapKwetu brings public infrastructure datasets together for exploration. These are snapshots with different dates, methods, and levels of coverage. Read the layer notes before interpreting a location or comparing countries.</p>
        <div className="kw-source-table-wrap" role="region" aria-label="Atlas source notes" tabIndex={0}><table className="kw-source-table"><thead><tr><th scope="col">LAYER</th><th scope="col">SOURCE</th><th scope="col">WHAT TO KEEP IN MIND</th></tr></thead><tbody>{DATA_SOURCES.map((source) => <tr key={source.label}><td>{source.label}</td><td><a href={source.href} target="_blank" rel="noreferrer">{source.publisher} ↗</a><small>{source.detail}</small></td><td>{source.coverage}</td></tr>)}</tbody></table></div>
        <div className="kw-source-limits"><div><h2>Transition records and provenance</h2><p>The transition snapshots preserve original record identifiers, source releases, units, location confidence, and publisher links. African filtering and field normalisation are MapKwetu modifications. Download mirrors are identified instead of being presented as direct publisher downloads.</p><p><a href="/data/transition/manifest.json">Download the snapshot manifest</a> for retrieval dates, original download URLs, SHA-256 checksums, record counts, and reuse notes. Refresh is manual, not a continuous live feed.</p></div><div><h2>Emissions scenario methodology</h2><p>The scenario uses estimated 2025 power-facility emissions from Climate TRACE, expressed in tonnes CO₂e with AR6 GWP100. The selected country defines the record subset. Baseline × (1 + activity change) × (1 − reduction) gives an illustrative annual result.</p><p>It is not a validated forecast, a national inventory, or measured avoided emissions. Capture capacity, proposed projects, and different gases are not automatically subtracted or summed. <Link href="/transition#scenario">Explore the scenario tool ↗</Link></p></div></div>
        <div className="kw-source-limits"><div><h2>How totals are calculated</h2><p>Plant counts and capacity totals describe the records in the loaded plant dataset. Capacity is the sum of reported megawatts, displayed in gigawatts; it is not current electricity generation or power available for a new connection.</p><p>Fuel and country filters operate on those records. A renewable label follows the atlas’s fuel classification, including storage categories; it does not establish the energy source used to charge a storage facility.</p></div><div><h2>How the map is refreshed</h2><p>The repository includes prepared data files. The Python preparation pipeline downloads and processes upstream sources when it is run; there is no continuous live feed or published refresh schedule.</p><p>For project research, request record dates, a defined geographic scope, and checks against current local sources. Detailed feasibility, tariffs, reliability, connection terms, and site-level permissions need additional investigation.</p></div></div>
        <div className="kw-source-cta"><p>Start exploring the data, or prepare a brief around the information your project still needs.</p><Link className="kw-button" href="/atlas">Open the atlas <ArrowUpRight size={18} /></Link></div>
      </section><SiteFooter />
    </main>
  );
}
