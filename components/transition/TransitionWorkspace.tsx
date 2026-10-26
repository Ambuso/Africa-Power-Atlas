'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Download, RefreshCw, Search, X } from 'lucide-react';
import { calculateEmissionsScenario, exportTransitionCsv, filterTransitionRecords, formatCapacity, isTransitionDataset, STATUS_LABELS, TRANSITION_DATASETS, TRANSITION_KEYS, type TransitionProperties, type TransitionRecord } from '@/lib/transition';
import { useTransitionData } from './useTransitionData';

function download(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sourceUrl(value: string): string | undefined {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}

export default function TransitionWorkspace() {
  const { manifest, records, loading, error, retry } = useTransitionData();
  const [dataset, setDataset] = useState('all'); const [country, setCountry] = useState('all');
  const [status, setStatus] = useState('all'); const [query, setQuery] = useState('');
  const [page, setPage] = useState(0); const [detail, setDetail] = useState<TransitionRecord | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]); const [storageReady, setStorageReady] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [notice, setNotice] = useState(''); const [activity, setActivity] = useState(0); const [reduction, setReduction] = useState(20);
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('dataset');
    if (isTransitionDataset(initial)) setDataset(initial);
    const parameters = new URLSearchParams(window.location.search);
    if (parameters.get('query')) setQuery(parameters.get('query') || '');
    if (parameters.get('country')) setCountry(parameters.get('country') || 'all');
    try { const saved: unknown = JSON.parse(localStorage.getItem('mapkwetu-transition-shortlist') || '[]'); if (Array.isArray(saved)) setShortlist(saved.filter((id): id is string => typeof id === 'string').slice(0, 3)); } catch {}
    setStorageReady(true);
  }, []);
  useEffect(() => { if (storageReady) { try { localStorage.setItem('mapkwetu-transition-shortlist', JSON.stringify(shortlist)); } catch {} } }, [shortlist, storageReady]);
  useEffect(() => { setPage(0); }, [dataset, country, status, query]);
  useEffect(() => {
    if (!detail) return;
    const previous = returnFocusRef.current;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetail(null);
      if (event.key !== 'Tab') return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [detail]);

  const countries = useMemo(() => Array.from(new Map(records.map(({ properties: p }) => [p.iso3, p.country])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [records]);
  const filtered = useMemo(() => filterTransitionRecords(records, { dataset, country, status, query }), [records, dataset, country, status, query]);
  const compared = records.filter((record) => shortlist.includes(record.properties.id));
  const selectedEmissions = records.filter(({ properties: p }) => p.dataset === 'emissions' && (country === 'all' || p.iso3 === country) && p.gas === 'co2e_100yr' && p.year === 2025 && p.emissions_tonnes !== null);
  const baseline = selectedEmissions.reduce((sum, record) => sum + (record.properties.emissions_tonnes || 0), 0);
  const scenario = baseline > 0 ? calculateEmissionsScenario(baseline, activity, reduction) : null;
  const shown = filtered.slice(page * 25, (page + 1) * 25);
  function toggle(record: TransitionRecord) {
    const id = record.properties.id;
    if (shortlist.includes(id)) { setShortlist((ids) => ids.filter((saved) => saved !== id)); setNotice(''); }
    else if (shortlist.length < 3) { setShortlist((ids) => [...ids, id]); setNotice(''); }
    else setNotice('Compare up to three records. Remove one from your shortlist to add another.');
  }
  function exportBrief() {
    download(JSON.stringify({ title: 'MapKwetu research shortlist', exported_at: new Date().toISOString(), records: compared, snapshots: manifest?.datasets, note: 'Source snapshots, not independently verified current project status. Units and source dates differ; this is a research shortlist, not a feasibility assessment.' }, null, 2), 'mapkwetu-research-shortlist.json', 'application/json');
  }
  return <section className="kw-workspace">
    <p className="kw-eyebrow">MAPKWETU / TRANSITION WORKSPACE</p>
    <div className="kw-transition-heading"><div><h1>Follow the projects.<br /><span>Question the assumptions.</span></h1><p>Search African transition records, build a three-record shortlist, and test an emissions scenario against an explicitly defined historical baseline.</p></div><Link href="/atlas" className="kw-button">Open the atlas <ArrowUpRight size={18} /></Link></div>
    <div className="kw-workspace-stats">{TRANSITION_KEYS.map((key) => <button key={key} className={dataset === key ? 'is-active' : ''} onClick={() => setDataset(dataset === key ? 'all' : key)} aria-pressed={dataset === key}><span style={{ color: TRANSITION_DATASETS[key].color }}>{TRANSITION_DATASETS[key].short}</span><strong>{manifest?.datasets[key]?.record_count.toLocaleString() ?? '—'}</strong><span>{TRANSITION_DATASETS[key].label}</span><small>{manifest?.datasets[key]?.source_release || (loading ? 'Loading snapshot…' : 'Unavailable')}</small></button>)}</div>
    {error && <div className="kw-data-error" role="alert">{error}<button onClick={retry}><RefreshCw size={14} />Retry</button></div>}
    <div className="kw-workspace-controls"><label className="kw-workspace-search"><Search size={16} /><span className="sr-only">Search project records</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project, technology, operator…" /></label><label><span>Dataset</span><select value={dataset} onChange={(event) => setDataset(event.target.value)}><option value="all">All datasets</option>{TRANSITION_KEYS.map((key) => <option key={key} value={key}>{TRANSITION_DATASETS[key].label}</option>)}</select></label><label><span>Country</span><select value={country} onChange={(event) => setCountry(event.target.value)}><option value="all">All represented countries</option>{countries.map(([iso3, name]) => <option key={iso3} value={iso3}>{name}</option>)}</select></label><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Every stage</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="kw-workspace-table-heading"><span>{loading ? 'Loading source snapshots…' : `${filtered.length.toLocaleString()} records matching your filters`}</span><button disabled={loading || !!error || !filtered.length} onClick={() => download(exportTransitionCsv(filtered), 'mapkwetu-filtered-records.csv', 'text/csv;charset=utf-8')}><Download size={14} />Export filtered CSV</button></div>
    <div className="kw-project-table-wrap" role="region" aria-label="Transition project records" tabIndex={0}><table className="kw-project-table"><thead><tr><th scope="col">Compare</th><th scope="col">Project / source</th><th scope="col">Country</th><th scope="col">Status</th><th scope="col">Reported capacity / estimate</th><th scope="col">Map</th></tr></thead><tbody>{shown.map((record) => { const p = record.properties; return <tr key={p.id}><td><input type="checkbox" aria-label={`Compare ${p.name}`} checked={shortlist.includes(p.id)} onChange={() => toggle(record)} /></td><td><button className="kw-project-name" onClick={(event) => { returnFocusRef.current = event.currentTarget; setDetail(record); }}>{p.name}</button><small>{TRANSITION_DATASETS[p.dataset].label} · {p.source_release}</small></td><td>{p.country}</td><td><span className={`kw-project-status kw-status-${p.status}`}>{STATUS_LABELS[p.status] || p.status}</span><small>{p.source_status}</small></td><td>{formatCapacity(p)}<small>{p.dataset === 'emissions' ? `${p.year} · estimated · CO₂e AR6 GWP100` : p.year ? `Source start/target year: ${p.year}` : 'Start year not reported'}</small></td><td><Link href={`/atlas?dataset=${p.dataset}&country=${p.iso3}&record=${encodeURIComponent(p.id)}`} aria-label={`View ${p.name} on the atlas`}>{record.geometry ? 'Locate ↗' : 'Country view ↗'}</Link></td></tr>; })}</tbody></table>{!loading && !filtered.length && <p className="kw-empty-state">No records match these filters. Try another country, status, or search.</p>}</div>
    <div className="kw-table-pagination"><span>{filtered.length ? `${page * 25 + 1}–${Math.min((page + 1) * 25, filtered.length)} of ${filtered.length}` : '0 records'} · Snapshot records, not a complete current inventory</span><div><button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={(page + 1) * 25 >= filtered.length} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
    <section className="kw-compare-section" aria-labelledby="compare-title"><div className="kw-workspace-section-heading"><div><p className="kw-eyebrow">YOUR RESEARCH SHORTLIST</p><h2 id="compare-title">Compare the context.</h2></div><button disabled={!compared.length} onClick={exportBrief}><Download size={14} />Export shortlist & sources</button></div>{notice && <p role="status" className="kw-workspace-notice">{notice}</p>}{compared.length ? <div className="kw-comparison-grid">{compared.map((record) => { const p = record.properties; return <article key={p.id}><button className="kw-compare-remove" aria-label={`Remove ${p.name} from comparison`} onClick={() => toggle(record)}><X size={15} /></button><span className="kw-eyebrow">{TRANSITION_DATASETS[p.dataset].label}</span><h3>{p.name}</h3><dl><dt>Country</dt><dd>{p.country}</dd><dt>Source status</dt><dd>{p.source_status || 'Not reported'}</dd><dt>Reported capacity / estimate</dt><dd>{formatCapacity(p)}</dd><dt>Technology</dt><dd>{p.technology || 'Not reported'}</dd><dt>Location confidence</dt><dd>{p.location_accuracy}</dd><dt>Source release</dt><dd>{p.source_release}</dd></dl><button onClick={(event) => { returnFocusRef.current = event.currentTarget; setDetail(record); }}>Read record & source ↗</button></article>; })}</div> : <p className="kw-empty-state">Select up to three records in the table. Your shortlist is saved on this device. Capacity units remain separate across technologies.</p>}</section>
    <section className="kw-scenario" id="scenario" aria-labelledby="scenario-title"><div className="kw-scenario-copy"><p className="kw-eyebrow">TRANSPARENT EMISSIONS SCENARIOS</p><h2 id="scenario-title">Change an assumption.<br />See the consequence.</h2><p>This arithmetic scenario uses Climate TRACE’s estimated 2025 power-sector emissions for {country === 'all' ? 'all represented African countries' : countries.find(([code]) => code === country)?.[1] || country}. It includes {selectedEmissions.length} inventory records and follows the country filter only.</p><p><strong>Annual scenario = baseline × (1 + activity change) × (1 − reduction).</strong></p><p>It is not a validated forecast, a national emissions total, or evidence of avoided emissions. Capture nameplate capacity and proposed projects are never subtracted automatically.</p><label>Activity change <output>{activity > 0 ? '+' : ''}{activity}%</output><input type="range" min={-90} max={200} step={5} value={activity} onChange={(event) => setActivity(Number(event.target.value))} /></label><label>Assumed emissions reduction <output>{reduction}%</output><input type="range" min={0} max={100} step={1} value={reduction} onChange={(event) => setReduction(Number(event.target.value))} /></label></div><div className="kw-scenario-result">{scenario ? <><span className="kw-eyebrow">ANNUAL TONNES CO₂e · AR6 GWP100</span><div className="kw-scenario-number"><span>Illustrative annual scenario</span><strong>{(scenario.scenario / 1000000).toLocaleString(undefined, { maximumFractionDigits: 2 })}<small>Mt CO₂e</small></strong></div><div className="kw-scenario-bar"><span>2025 estimated baseline</span><strong>{(baseline / 1000000).toFixed(2)} Mt</strong><i style={{ width: `${baseline / Math.max(baseline, scenario.scenario) * 100}%` }} /></div><div className="kw-scenario-bar kw-scenario-bar-result"><span>Your scenario</span><strong>{(scenario.scenario / 1000000).toFixed(2)} Mt</strong><i style={{ width: `${scenario.scenario / Math.max(baseline, scenario.scenario) * 100}%` }} /></div><p>{Math.abs(scenario.difference / 1000000).toFixed(2)} Mt {scenario.difference >= 0 ? 'below' : 'above'} the historical baseline under your assumptions.</p><button onClick={() => download(JSON.stringify({ ...scenario, units: 'tonnes CO2e AR6 GWP100 per year', baseline_year: 2025, country, record_count: selectedEmissions.length, activity_change_percent: activity, reduction_percent: reduction, source: manifest?.datasets.emissions, method: 'baseline * (1 + activity_change_percent/100) * (1 - reduction_percent/100)', limitations: 'Illustrative arithmetic scenario; not a validated forecast or measured avoided emissions.' }, null, 2), 'mapkwetu-emissions-scenario.json', 'application/json')}><Download size={14} />Export assumptions & result</button></> : <p className="kw-empty-state">{loading ? 'Loading the 2025 emissions snapshot…' : 'No positive reported emissions baseline for this country. Choose another country to test a scenario.'}</p>}</div></section>
    {detail && <div className="kw-record-overlay" onClick={() => setDetail(null)}><section ref={dialogRef} className="kw-record-detail" role="dialog" aria-modal="true" aria-labelledby="record-title" onClick={(event) => event.stopPropagation()}><button className="kw-detail-close" onClick={() => setDetail(null)} autoFocus aria-label="Close record"><X size={20} /></button><p className="kw-eyebrow">{TRANSITION_DATASETS[detail.properties.dataset].label}</p><h2 id="record-title">{detail.properties.name}</h2><dl>{Object.entries({ Country: detail.properties.country, 'Source status': detail.properties.source_status, Technology: detail.properties.technology, 'Capacity / annual estimate': formatCapacity(detail.properties), 'Location accuracy': detail.properties.location_accuracy, Publisher: detail.properties.source, 'Source release': detail.properties.source_release, Notes: detail.properties.notes }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not reported'}</dd></div>)}</dl><a href={sourceUrl(detail.properties.source_url)} target="_blank" rel="noreferrer">Open original source ↗</a><button onClick={() => toggle(detail)}>{shortlist.includes(detail.properties.id) ? 'Remove from comparison' : 'Add to comparison'}</button><p>Values and status are as recorded in the source snapshot. No current site verification is implied.</p></section></div>}
  </section>;
}
