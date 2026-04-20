/* ==================== app/layout.tsx ==================== */
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

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
      <body className="m-0 h-full w-full overflow-hidden p-0 antialiased">
        <div id="app-root" className="relative h-screen w-screen overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
