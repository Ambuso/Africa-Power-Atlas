'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Download, FileText, Globe2, Layers3, MapPin, Plus, Radio, Trash2, Zap } from 'lucide-react';
import { Brand } from '@/components/marketing/Brand';
import { KENYA_STARTERS, MAX_CANDIDATES, readShortlist, SHORTLIST_KEY, siteBrief } from '@/lib/intelligence';
import { SITE_LAYERS, type SiteReport } from '@/lib/site-check';

const layerNames = { plants: 'Power plants', substations: 'Substations', transmission: 'Transmission routes', dataCentres: 'Data centres', landingStations: 'Cable landing stations', fibreRoutes: 'Fibre routes' };

export default function IntelligenceWorkspace() {
  const [label, setLabel] = useState('Nairobi candidate');
  const [latitude, setLatitude] = useState('-1.2921'), [longitude, setLongitude] = useState('36.8219');
  const [radius, setRadius] = useState(50), [report, setReport] = useState<SiteReport | null>(null);
  const [shortlist, setShortlist] = useState<SiteReport[]>([]), [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [view, setView] = useState<'screen' | 'compare'>('screen');
  const controller = useRef<AbortController | null>(null);
  const results = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    try { setShortlist(readShortlist(localStorage.getItem(SHORTLIST_KEY))); } catch { setMessage('Browser storage is unavailable. You can still screen and export this session.'); }
    setReady(true);
    return () => controller.current?.abort();
  }, []);
  function persist(next: SiteReport[]) {
    setShortlist(next);
    try { localStorage.setItem(SHORTLIST_KEY, JSON.stringify(next)); }
    catch { setMessage('Your shortlist is available for this session only. Export a brief to keep it.'); }
  }
  function invalidate() { controller.current?.abort(); setLoading(false); setReport(null); setError(''); setMessage(''); }
  async function screen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setLoading(true); setReport(null); setError(''); setMessage('');
    try {
      const response = await fetch('/api/site-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, latitude: Number(latitude), longitude: Number(longitude), radiusKm: radius }), signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Screening failed. Please try again.');
      if (data.report?.country !== 'Kenya') throw new Error('Choose a location inside Kenya. The continental Site Check supports other African countries.');
      if (request.signal.aborted) return;
      setReport(data.report); requestAnimationFrame(() => results.current?.focus());
    } catch (failure) { if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : 'Screening failed. Please try again.'); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }
  function save() {
    if (!report) return;
    const others = shortlist.filter((item) => item.site.latitude !== report.site.latitude || item.site.longitude !== report.site.longitude || item.site.radiusKm !== report.site.radiusKm);
    if (others.length >= MAX_CANDIDATES) { setMessage('Your shortlist has five candidates. Remove one before adding another.'); return; }
    setMessage('Candidate saved to this browser.'); persist([...others, report]);
  }
  function exportBrief(items: SiteReport[]) {
    const url = URL.createObjectURL(new Blob([siteBrief(items)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'atlas-intelligence-kenya-brief.txt'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Research brief downloaded with sources, dates and verification questions.');
  }
  return <main className="ai-workspace">
    <aside className="ai-sidebar"><Brand /><div className="ai-product-label">ATLAS INTELLIGENCE <span>EARLY ACCESS</span></div>
      <nav aria-label="Intelligence navigation"><button className={view === 'screen' ? 'active' : ''} onClick={() => setView('screen')}><MapPin size={16} /> Site explorer <ChevronRight size={13} /></button><button className={view === 'compare' ? 'active' : ''} onClick={() => setView('compare')}><Layers3 size={16} /> Your shortlist <span>{ready ? shortlist.length : 0}</span></button><Link href="/atlas"><Globe2 size={16} /> Continental atlas <ArrowUpRight size={13} /></Link><Link href="/sources"><FileText size={16} /> Sources & methods <ArrowUpRight size={13} /></Link></nav>
      <div className="ai-market"><span className="ai-live-dot" /> INITIAL MARKET<strong>Kenya</strong><p>Renewable energy<br />project screening</p></div>
      <div className="ai-sidebar-bottom"><p>Better context.<br /><strong>Better next questions.</strong></p><Link href="/#request">Discuss a pilot <ArrowUpRight size={14} /></Link></div>
    </aside>
    <div className="ai-main"><header className="ai-topbar"><span>Workspace <ChevronRight size={12} /> Kenya <ChevronRight size={12} /> {view === 'screen' ? 'Site explorer' : 'Shortlist'}</span><Link href="/site-check">Africa Site Check <ArrowUpRight size={13} /></Link></header>
      <div className="ai-content"><div className="ai-heading"><div><p className="ai-eyebrow">KENYA / PRELIMINARY SITE SCREENING</p><h1>{view === 'screen' ? 'Find your next starting point.' : 'Put your candidates in context.'}</h1><p>{view === 'screen' ? 'Bring a location. Explore mapped infrastructure and the questions worth asking next.' : 'Compare your saved screening snapshots before choosing where to investigate.'}</p></div><span className="ai-stage"><span className="ai-live-dot" /> Research preview</span></div>
      <div className="ai-context-note"><Radio size={16} /><p>Source snapshots, with visible limits. Grid proximity does not establish connection capacity or project feasibility. Solar yield, terrain and protected-area screening are not yet included.</p><Link href="/sources">Methods <ArrowUpRight size={13} /></Link></div>
      {view === 'screen' ? <>
        <div className="ai-screen-grid"><section className="ai-location"><div className="ai-panel-title"><span>01</span><h2>Choose a location</h2><MapPin size={16} /></div>
          <form onSubmit={screen}><label>Candidate name<input required maxLength={160} value={label} onChange={(event) => { invalidate(); setLabel(event.target.value); }} placeholder="e.g. Naivasha solar candidate" /></label><div className="ai-coordinate-row"><label>Latitude<input type="number" required step="any" min={-5} max={6} value={latitude} onChange={(event) => { invalidate(); setLatitude(event.target.value); }} /></label><label>Longitude<input type="number" required step="any" min={33} max={42} value={longitude} onChange={(event) => { invalidate(); setLongitude(event.target.value); }} /></label></div><label>Generation search radius<select value={radius} onChange={(event) => { invalidate(); setRadius(Number(event.target.value)); }}>{[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value} km</option>)}</select></label><button className="ai-primary" disabled={loading} type="submit">{loading ? 'Screening source records…' : 'Screen this location'}<ArrowRight size={15} /></button></form>
          <div className="ai-starters"><p className="ai-eyebrow">START WITH AN AREA</p><div>{KENYA_STARTERS.map((site) => <button key={site.label} onClick={() => { invalidate(); setLabel(site.label); setLatitude(String(site.latitude)); setLongitude(String(site.longitude)); }}><MapPin size={11} />{site.label}</button>)}</div><p>Approximate city locations for exploration. Enter your exact site coordinates before making comparisons.</p></div>
        </section><section className="ai-map-context" aria-label="Geographic context"><div className="ai-map-top"><span><Globe2 size={13} /> AFRICA / KENYA</span><Link href="/atlas">Explore interactive map <ArrowUpRight size={13} /></Link></div><img src="/mapkwetu-atlas.svg" alt="Continental infrastructure overview. Illustrative context, not the selected site location." width="720" height="760" /><div className="ai-map-card"><span className="ai-live-dot" /><div>From a pin to a clearer picture.<small>Screen exact coordinates with the form.</small></div></div><span className="ai-map-caption">Continental overview · Natural Earth / WRI · Not a site-pin map</span></section></div>
        {loading && <p className="ai-notice" role="status">Checking mapped records and source coverage…</p>}
        {error && <p className="ai-error" role="alert">{error} <Link href="/site-check">Open Africa Site Check ↗</Link></p>}
        {report ? <section className="ai-results"><div className="ai-results-heading"><div><p className="ai-eyebrow">02 / SCREENING SNAPSHOT</p><h2 tabIndex={-1} ref={results}>{report.site.label}</h2><p>{report.country} · {report.site.latitude.toFixed(5)}, {report.site.longitude.toFixed(5)} · {report.site.radiusKm} km radius · {new Date(report.createdAt).toLocaleDateString()}</p></div><div className="ai-result-actions"><button className="ai-secondary" onClick={() => exportBrief([report])}><Download size={14} /> Export brief</button><button className="ai-primary" onClick={save} disabled={!ready}><Plus size={14} /> Save candidate</button></div></div>
          <div className="ai-metrics">{(['substations', 'transmission', 'plants'] as const).map((key) => { const nearest = report.nearest[key][0]; return <article key={key}><span>{layerNames[key]}</span><strong>{nearest ? nearest.distanceKm.toFixed(1) : '—'}<small>{nearest ? ' km' : ''}</small></strong><p>{nearest?.name || 'Source coverage unavailable'}</p><small>{nearest ? nearest.withinRadius ? 'Nearest mapped record' : 'Outside selected radius' : 'This is a data gap, not evidence of absence'}</small></article>; })}<article><span>Nearby generation</span><strong>{report.fuelMix.reduce((sum, group) => sum + group.reportedMW, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}<small> MW</small></strong><p>Reported nameplate capacity</p><small>Within {report.site.radiusKm} km · Not available grid capacity</small></article></div>
          <div className="ai-evidence"><section><div className="ai-panel-title"><Zap size={15} /><h2>Generation context</h2></div>{report.fuelMix.length ? report.fuelMix.map((group) => <div className="ai-fuel" key={group.fuel}><span>{group.fuel}<small>{group.plants} records · {group.missingCapacity} missing capacities</small></span><strong>{group.reportedMW.toLocaleString()} MW</strong></div>) : <p>No mapped plants within this radius.</p>}<p className="ai-fine">Historical nameplate MW from source records. Does not describe current output or reliable supply.</p></section><section><div className="ai-panel-title"><Check size={15} /><h2>What to verify next</h2></div><ul>{report.unknowns.map((item) => <li key={item}>{item}</li>)}</ul></section></div>
          <details className="ai-source-details" open><summary>Sources, coverage & data dates</summary><div className="ai-source-table">{SITE_LAYERS.map((key) => <div key={key}><span>{layerNames[key]}<small>{report.sources[key].name}</small></span><span className={report.sources[key].count ? 'ai-coverage-ok' : 'ai-coverage-gap'}>{report.sources[key].count ? `${report.sources[key].count.toLocaleString()} records` : 'Not loaded'}</span><span>{report.sources[key].release}</span><a href={report.sources[key].url} target="_blank" rel="noreferrer">Source ↗</a></div>)}</div><p className="ai-fine">Record counts describe the continental source snapshot. Water context: {report.water.category}. {report.water.note}</p><ul>{report.methodology.map((item) => <li key={item}>{item}</li>)}</ul><p className="ai-fine">Snapshot fingerprint: {report.version}</p></details>
        </section> : !loading && <div className="ai-empty"><FileText size={22} /><div><h2>Your research starts with one location.</h2><p>Run a screen to see real source records, coverage gaps and verification questions. Save up to five candidates to compare.</p></div></div>}
      </> : <section className="ai-comparison"><div className="ai-results-heading"><div><h2>Your shortlist <span className="ai-count">{shortlist.length} / {MAX_CANDIDATES}</span></h2><p>Saved in this browser. Snapshots retain their original dates and search radii.</p></div><button className="ai-secondary" disabled={!shortlist.length} onClick={() => exportBrief(shortlist)}><Download size={14} /> Export comparison brief</button></div>{shortlist.length ? <><div className="ai-comparison-scroll"><table><caption>Preliminary location comparison · no suitability ranking</caption><thead><tr><th scope="col">Evidence</th>{shortlist.map((item) => <th scope="col" key={item.id}>{item.site.label}<small>{item.site.latitude.toFixed(4)}, {item.site.longitude.toFixed(4)}</small></th>)}</tr></thead><tbody><tr><th scope="row">Screened</th>{shortlist.map((item) => <td key={item.id}>{new Date(item.createdAt).toLocaleDateString()}</td>)}</tr><tr><th scope="row">Generation radius</th>{shortlist.map((item) => <td key={item.id}>{item.site.radiusKm} km</td>)}</tr>{(['substations', 'transmission', 'plants'] as const).map((key) => <tr key={key}><th scope="row">Nearest {layerNames[key].toLowerCase()}</th>{shortlist.map((item) => { const asset = item.nearest[key][0]; return <td key={item.id}>{asset ? `${asset.distanceKm.toFixed(1)} km` : 'Coverage gap'}<small>{asset?.name || 'No usable source record'}{asset && !asset.withinRadius ? ' · Outside radius' : ''}</small></td>; })}</tr>)}<tr><th scope="row">Nearby nameplate MW</th>{shortlist.map((item) => <td key={item.id}>{item.fuelMix.reduce((sum, group) => sum + group.reportedMW, 0).toLocaleString()}<small>Historical reported capacity</small></td>)}</tr><tr><th scope="row">Water context</th>{shortlist.map((item) => <td key={item.id}>{item.water.category}</td>)}</tr><tr><th scope="row">Candidate actions</th>{shortlist.map((item) => <td key={item.id}><button className="ai-table-action" onClick={() => { invalidate(); setReport(item); setLabel(item.site.label); setLatitude(String(item.site.latitude)); setLongitude(String(item.site.longitude)); setRadius(item.site.radiusKm); setView('screen'); }}>View evidence <ArrowUpRight size={12} /></button><button className="ai-remove" aria-label={`Remove ${item.site.label}`} onClick={() => persist(shortlist.filter((candidate) => candidate.id !== item.id))}><Trash2 size={12} /> Remove</button></td>)}</tr></tbody></table></div><p className="ai-fine">Different radii or data fingerprints can affect comparability. Refresh a candidate by running its coordinates again. Export includes each snapshot’s sources and methods.</p></> : <div className="ai-empty"><Layers3 size={24} /><div><h2>Build a shortlist worth investigating.</h2><p>Screen a location and save it here to compare mapped infrastructure.</p><button className="ai-table-action" onClick={() => setView('screen')}>Screen your first location <ArrowRight size={14} /></button></div></div>}</section>}
      {message && <p className="ai-notice" role="status">{message}</p>}
      <footer className="ai-workspace-footer"><span>MAPKWETU / ATLAS INTELLIGENCE</span><span>Preliminary context. Human judgement.</span></footer>
      </div>
    </div>
  </main>;
}
