import type { Metadata } from 'next';
import IntelligenceWorkspace from '@/components/intelligence/IntelligenceWorkspace';

export const metadata: Metadata = {
  title: 'Atlas Intelligence · Kenya site screening',
  description: 'Screen Kenyan project locations, compare mapped infrastructure, inspect coverage gaps and export a preliminary research brief.',
};

export default function IntelligencePage() {
  return <IntelligenceWorkspace />;
}
