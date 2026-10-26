import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/marketing/Brand';
import TransitionWorkspace from '@/components/transition/TransitionWorkspace';

export const metadata: Metadata = {
  title: 'Transition workspace · MapKwetu',
  description: 'Explore African hydrogen, carbon capture, geothermal and power-sector emissions datasets. Compare records and test transparent emissions scenarios.',
};

export default function TransitionPage() {
  return <main className="kw-site"><SiteHeader /><TransitionWorkspace /><SiteFooter /></main>;
}
