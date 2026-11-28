'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Ctx = { introDone: boolean; markDone: () => void };
const IntroContext = createContext<Ctx>({ introDone: false, markDone: () => {} });

/** Shared completion state for the optional homepage introduction. */
export function IntroProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [introDone, setDone] = useState(pathname !== '/');
  const markDone = useCallback(() => setDone(true), []);
  const value = useMemo(() => ({ introDone, markDone }), [introDone, markDone]);
  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>;
}

export function IntroContent({ children }: { children: ReactNode }) {
  const { introDone } = useIntro();
  const inert = !introDone ? '' : undefined;
  return (
    <div id="intro-content" inert={inert as unknown as boolean | undefined} aria-hidden={!introDone}>
      {children}
    </div>
  );
}

export const useIntro = () => useContext(IntroContext);
