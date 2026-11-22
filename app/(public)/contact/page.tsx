import type { Metadata } from 'next';
import ContactForm from '@/components/ContactForm';
import PageHeader from '@/components/PageHeader';
import Reveal from '@/components/Reveal';

export const metadata: Metadata = { title: 'Contact' };

const TOPICS: Record<string, string> = { hire: 'Hiring enquiry' };

export default function ContactPage({ searchParams }: { searchParams: { topic?: string } }) {
  return (
    <section className="mx-auto grid w-full max-w-page gap-7 px-[var(--gutter)] pb-8 pt-7 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <PageHeader eyebrow="Contact" title="Start an enquiry" intro="Describe the system you need built or the product you want to evaluate. Enquiries are read directly." />
      </div>
      <Reveal delay={0.25} className="lg:col-span-6 lg:col-start-7">
        <ContactForm defaultSubject={TOPICS[searchParams.topic ?? ''] ?? ''} />
      </Reveal>
    </section>
  );
}
