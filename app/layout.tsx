/* ==================== app/layout.tsx ==================== */
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'Africa Power Atlas',
  description:
    "Interactive explorer of Africa's power plants, transmission lines, substations, data centers, submarine cables, and infrastructure risk overlays.",
  applicationName: 'Africa Power Atlas',
  keywords: [
    'Africa power grid',
    'energy infrastructure',
    'power plants',
    'transmission lines',
    'substations',
    'submarine cables',
    'geospatial dashboard',
    'MapLibre',
  ],
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Africa Power Atlas',
    description: "Interactive visualization of Africa's energy infrastructure.",
    images: [{ url: '/og-image.jpg' }],
    type: 'website',
    locale: 'en_US',
    siteName: 'Africa Power Atlas',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Africa Power Atlas',
    description: "Interactive map of Africa's energy infrastructure",
    images: ['/og-image.jpg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#020617',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full dark" suppressHydrationWarning>
      <body
        className="m-0 h-full w-full overflow-hidden bg-[#020617] p-0 text-slate-50 antialiased"
        style={{ fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"' }}
      >
        <div id="app-root" className="relative h-screen w-screen overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
