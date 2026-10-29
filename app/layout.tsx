/* ==================== app/layout.tsx ==================== */
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './mapkwetu.css';
import './home.css';
import './intelligence.css';
import './transition.css';
import './site-check.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://africapowergrid.vercel.app'),
  title: 'MapKwetu',
  description:
    "Explore Africa’s energy and digital infrastructure. Use the free MapKwetu atlas and prepare a brief for country research or a custom dashboard.",
  applicationName: 'MapKwetu',
  keywords: [
    'Africa power grid',
    'energy infrastructure',
    'power plants',
    'transmission lines',
    'substations',
    'submarine cables',
    'geospatial dashboard',
  ],
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'MapKwetu',
    description: "Interactive visualization of Africa's energy infrastructure.",
    type: 'website',
    locale: 'en_US',
    siteName: 'MapKwetu',
  },
  twitter: {
    card: 'summary',
    title: 'MapKwetu',
    description: "Interactive map of Africa's energy infrastructure",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#070912',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full dark ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="m-0 min-h-full w-full p-0 antialiased">
        <div id="app-root" className="relative min-h-screen w-full">
          {children}
        </div>
      </body>
    </html>
  );
}

