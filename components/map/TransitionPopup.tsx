import Link from 'next/link';
import { X } from 'lucide-react';
import { formatCapacity, TRANSITION_DATASETS, type TransitionProperties } from '@/lib/transition';

export default function TransitionPopup({ record, onClose }: { record: TransitionProperties; onClose: () => void }) {
  const summary = record.record_kind === 'country_summary';
  return <aside className="kw-atlas-record" aria-label="Transition dataset record">
    <div className="kw-atlas-record-accent" style={{ background: TRANSITION_DATASETS[record.dataset].color }} />
    <button className="kw-atlas-record-close" onClick={onClose} aria-label="Close transition record"><X size={17} /></button>
    <span className="kw-atlas-record-label">{TRANSITION_DATASETS[record.dataset].label}</span>
    <h2>{record.name}</h2>
    <dl><div><dt>Country</dt><dd>{record.country}</dd></div><div><dt>{summary ? 'Representation' : 'Source status'}</dt><dd>{summary ? 'Country area · not a project pin' : record.source_status || 'Not reported'}</dd></div>{!summary && <div><dt>Reported capacity / estimate</dt><dd>{formatCapacity(record)}</dd></div>}<div><dt>Location accuracy</dt><dd>{record.location_accuracy}</dd></div><div><dt>Source release</dt><dd>{record.source_release}</dd></div></dl>
    <p>{record.notes}</p>
    <Link href={`/transition?dataset=${record.dataset}&country=${record.iso3}${summary ? '' : `&query=${encodeURIComponent(record.name)}`}`}>{summary ? 'Explore country records' : 'Read record, compare & export'} ↗</Link>
  </aside>;
}
