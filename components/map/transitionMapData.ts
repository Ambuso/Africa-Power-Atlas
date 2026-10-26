import type { FeatureCollection } from '@/lib/types';
import { featureMatchesCountries } from '@/lib/countries';
import { TRANSITION_DATASETS, type TransitionDataset } from '@/lib/transition';

/** Keep source coordinates; represent unlocated projects by labelled country
 * areas instead of inventing facility pins at capital or country centroids. */
export function prepareTransitionMapData(key: TransitionDataset, raw: FeatureCollection | null | undefined, countries: FeatureCollection | null | undefined, selectedCountries: string[], selectedStatus = 'all'): FeatureCollection {
  const records = (raw?.features || []).filter((feature) => featureMatchesCountries(feature.properties, selectedCountries) && (selectedStatus === 'all' || feature.properties.status === selectedStatus));
  const located = records.filter((feature) => feature.geometry?.type === 'Point');
  const unlocated = new Map<string, number>();
  for (const record of records) {
    if (record.geometry?.type === 'Point') continue;
    const iso3 = String(record.properties.iso3 || '');
    unlocated.set(iso3, (unlocated.get(iso3) || 0) + 1);
  }
  const areas = (countries?.features || []).flatMap((feature) => {
    const iso3 = String(feature.properties.iso3 || ''); const count = unlocated.get(iso3);
    if (!count || !feature.geometry) return [];
    return [{ ...feature, properties: {
      id: `${key}:country:${iso3}`, dataset: key, record_kind: 'country_summary', iso3,
      name: `${feature.properties.name}: ${count} unlocated ${TRANSITION_DATASETS[key].label.toLowerCase()} records`,
      country: feature.properties.name, status: 'unknown', source_status: 'Country summary — see individual project records',
      technology: '', capacity_value: null, capacity_unit: '', year: null,
      source: 'MapKwetu aggregation of source records', source_url: '/datasets', source_release: 'See individual dataset release',
      location_accuracy: 'Country area, not a project location', record_count: count,
      notes: 'The source does not publish usable facility coordinates for these records. Country shading shows coverage only; it does not locate a facility.',
    } }];
  });
  return { type: 'FeatureCollection', features: [...located, ...areas] };
}
