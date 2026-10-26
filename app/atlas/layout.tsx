import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Explore the atlas · MapKwetu',
  description: 'Explore Africa’s power plants, grid networks, data centres, submarine cables, and water stress using public datasets.',
};

export default function AtlasLayout({ children }: { children: ReactNode }) {
  return children;
}
