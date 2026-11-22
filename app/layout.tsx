import type { Metadata, Viewport } from 'next';
import '../styles/tokens.css';
import './globals.css';
import { IntroProvider } from '@/components/IntroProvider';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: { default: `${SITE.name} | ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: { title: SITE.name, description: SITE.tagline, siteName: SITE.name, type: 'website' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#08090C',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg font-sans text-ink">
        <noscript>
          <style>{`[data-reveal],[data-reveal-stagger]>*{opacity:1!important}.intro-gate{display:none}`}</style>
        </noscript>
        <IntroProvider>{children}</IntroProvider>
      </body>
    </html>
  );
}
