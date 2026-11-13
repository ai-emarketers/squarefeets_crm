// Root layout (server component) of the Next.js App Router.
import type { Metadata, Viewport } from 'next';
import './globals.css';

// Page <title>/<meta description> for every route.
export const metadata: Metadata = {
  title: 'SquareFeets Realty CRM',
  description: 'Real estate CRM for brokers — projects, properties, leads, deals and brokerage',
};
// Mobile viewport settings (responsive layout, safe-area support for notched phones).
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Root layout: wraps every page. Only loads fonts + global CSS; the actual UI is rendered by the engine in [[...slug]]/page.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* speed up Google Fonts loading (IBM Plex Sans / Mono used by the prototype design) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
