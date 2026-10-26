'use client';

import Link from 'next/link';
import { ArrowUpRight, Database, Download, RefreshCw } from 'lucide-react';
import { TRANSITION_DATASETS, TRANSITION_KEYS } from '@/lib/transition';
import { useTransitionData } from './useTransitionData';

export default function DatasetCatalogue() {
  const { manifest, loading, error, retry } = useTransitionData();
  return <section className="kw-datasets">
    <p className="kw-eyebrow">THE MAPKWETU DATA CATALOGUE</p>
    <div className="kw-transition-heading"><div><h1>Africa’s transition.<br /><span>Explore the evidence.</span></h1><p>Hydrogen, carbon capture, geothermal power, and emissions in one research workflow. Check the release, filter the records, compare projects, and take the source notes with you.</p></div><Link className="kw-button" href="/transition">Open the workspace <ArrowUpRight size={18} /></Link></div>
    {error && <div className="kw-data-error" role="alert">{error}<button onClick={retry}><RefreshCw size={14} />Retry</button></div>}
    <div className="kw-dataset-grid">{TRANSITION_KEYS.map((key) => {
      const definition = TRANSITION_DATASETS[key]; const snapshot = manifest?.datasets[key];
      return <article key={key} className="kw-dataset-card">
        <div className="kw-dataset-card-top"><span style={{ background: definition.color }}>{definition.short}</span><span>AFRICAN RECORDS / {loading ? 'LOADING' : snapshot?.source_release || 'UNAVAILABLE'}</span></div>
        <h2>{definition.label}</h2><p>{definition.description}</p>
        <div className="kw-dataset-metrics"><div><strong>{snapshot?.record_count.toLocaleString() ?? '—'}</strong><span>{key === 'geothermal' ? 'unit records' : key === 'emissions' ? 'facility estimates' : 'project records'}</span></div><div><strong>{snapshot?.country_count ?? '—'}</strong><span>countries represented</span></div></div>
        <dl><dt>Publisher / provenance</dt><dd>{snapshot?.source || 'See source notes'}</dd><dt>Units</dt><dd>{definition.unit}</dd><dt>Reuse</dt><dd>{snapshot?.license || 'See source notes'}</dd></dl>
        {snapshot && <p className="kw-dataset-coverage">{snapshot.coverage}<br />{snapshot.mapped_count} records have published usable coordinates. Unlocated records remain in the table; map country summaries are labelled separately.</p>}
        <div className="kw-dataset-card-actions"><Link href={`/transition?dataset=${key}`}>Explore records <ArrowUpRight size={15} /></Link><Link href={`/atlas?dataset=${key}`}>View on map ↗</Link></div>
        {snapshot && <a className="kw-data-download" href={`/data/transition/${definition.file}`} download><Download size={13} />Download snapshot with attribution</a>}
      </article>;
    })}</div>
    <div className="kw-dataset-method"><Database size={24} /><div><h2>Know the difference between a plan and an operating project.</h2><p>Source releases vary. Announced capacity is not output, capture capacity is not measured removal, and estimated emissions are not direct measurements. Source-linked records, explicit unknowns, and separate units help keep comparisons meaningful.</p><Link href="/sources">Read sources and methodology ↗</Link></div></div>
    <div className="kw-dataset-bottom"><div><p className="kw-eyebrow">MORE CONTEXT, SAME ATLAS</p><h2>Put transition projects<br />beside the infrastructure.</h2><p>The atlas also includes power plants, transmission lines, substations, data centres, submarine cables, and water stress.</p></div><Link href="/atlas" className="kw-button">Explore all map layers <ArrowUpRight size={17} /></Link></div>
  </section>;
}
