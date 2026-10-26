import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/marketing/Brand';
import SiteCheck from '@/components/site-check/SiteCheck';

export const metadata: Metadata = { title: 'Site Check · MapKwetu', description: 'Screen an African site against mapped substations, transmission, power plants, data centres, fibre, cable stations and water context. Get distances, sources and explicit unknowns.' };
export default function SiteCheckPage() { return <main className="kw-site"><SiteHeader /><SiteCheck /><SiteFooter /></main>; }
