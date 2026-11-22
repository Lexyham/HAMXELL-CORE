'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Ctx = { introDone: boolean; markDone: () => void };
const IntroContext = createContext<Ctx>({ introDone: true, markDone: () => {} });

/** Shared "intro finished" signal. Navbar, Footer, hero and smooth scroll all key off it. */
export function IntroProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The intro only ever plays when a visit starts on the homepage.
  const [introDone, setDone] = useState(pathname !== '/');
  const markDone = useCallback(() => setDone(true), []);
  const value = useMemo(() => ({ introDone, markDone }), [introDone, markDone]);
  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>;
}

export const useIntro = () => useContext(IntroContext);
