'use client';

import { useIntro } from '@/components/IntroProvider';

/**
 * Re-mounted by Next on every navigation, so each page change plays the same entrance: a thin sweep along the top edge
 * and a soft rise of the page content. The first load waits for the intro to finish.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const { introDone } = useIntro();
  return (
    <>
      {introDone && <div aria-hidden className="route-bar" />}
      <div className={introDone ? 'page-enter' : undefined}>{children}</div>
    </>
  );
}
