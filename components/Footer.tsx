import Link from 'next/link';
import { SOCIAL } from '@/content/site';
import { NAV, SITE } from '@/lib/site';
import Reveal from './Reveal';

const STACK = ['Next.js', 'TypeScript', 'Tailwind CSS'];

/** Public footer. Must never contain a link or mention of the private control centre. */
export default function Footer() {
  return (
    <footer className="border-t border-line bg-bg-secondary">
      <Reveal waitForIntro y={24} className="mx-auto grid w-full max-w-page gap-7 px-[var(--gutter)] py-7 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="font-sans text-small font-semibold tracking-[0.18em]">{SITE.name}</p>
          <p className="mt-3 max-w-[32ch] text-small text-ink-muted">{SITE.tagline}</p>
          {SOCIAL.length > 0 && <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">{SOCIAL.map((s) => <li key={s.href}><a href={s.href} target="_blank" rel="noopener noreferrer" className="font-mono text-label uppercase text-ink-muted hover:text-brand-gold">{s.label}</a></li>)}</ul>}
        </div>

        <nav aria-label="Sitemap" className="md:col-span-4 md:col-start-7">
          <p className="font-mono text-label uppercase text-ink-muted">Sitemap</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-small text-ink transition-colors hover:text-brand-gold">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/licenses" className="text-small text-ink transition-colors hover:text-brand-gold">
                Licences
              </Link>
            </li>
          </ul>
        </nav>

        <div className="md:col-span-2">
          <p className="font-mono text-label uppercase text-ink-muted">Built with</p>
          <ul className="mt-3 space-y-2 font-mono text-small text-ink">
            {STACK.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </Reveal>

      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-page px-[var(--gutter)] py-4 font-mono text-label uppercase text-ink-muted">
          &copy; {new Date().getFullYear()} {SITE.name}
        </p>
      </div>
    </footer>
  );
}
