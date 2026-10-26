import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/marketing/Brand';
import DatasetCatalogue from '@/components/transition/DatasetCatalogue';

export const metadata: Metadata = { title: 'Dataset catalogue · MapKwetu', description: 'Traceable African energy transition datasets with source releases, coverage, units, and map access.' };

export default function DatasetsPage() {
  return <main className="kw-site"><SiteHeader /><DatasetCatalogue /><SiteFooter /></main>;
}
