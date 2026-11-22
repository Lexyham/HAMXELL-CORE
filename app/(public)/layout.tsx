import Analytics from '@/components/Analytics';
import ChatWidget from '@/components/ChatWidget';
import CustomCursor from '@/components/CustomCursor';
import { configuredProviders, ROUTES } from '@/lib/ai/client';
import { flag } from '@/lib/flags';
import BackgroundEmblems from '@/components/BackgroundEmblems';
import Footer from '@/components/Footer';
import IntroGate from '@/components/IntroGate';
import Navbar from '@/components/Navbar';
import SmoothScroll from '@/components/SmoothScroll';

/** Public headquarters shell. The private control centre lives outside this group and shares none of it. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  // The launcher is shown only when the feature is on AND a provider that serves the chatbot is configured.
  const chatReady = flag('FEATURE_CHATBOT') && ROUTES.chatbot.some((p) => configuredProviders().includes(p));
  return (
    <>
      <Analytics />
      <CustomCursor />
      <IntroGate />
      <SmoothScroll />
      {/* #site is hidden by CSS while the intro plays (see styles/tokens.css), so the page can never show through. */}
      <div id="site" className="relative">
        <BackgroundEmblems />
        <div className="relative z-10">
          <Navbar />
          <main id="main" className="min-h-[70vh]">
            {children}
          </main>
          <Footer />
        </div>
      </div>
      {chatReady && <ChatWidget />}
    </>
  );
}
