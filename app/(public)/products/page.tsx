import type { Metadata } from 'next';
import PageHeader from '@/components/PageHeader';
import ProductDirectory from '@/components/ProductDirectory';
import { listPublic } from '@/lib/projects';

export const metadata: Metadata = { title: 'Products' };
export const revalidate = 60;

export default async function ProductsPage() {
  const products = await listPublic({ category: 'product' });
  return (
    <section className="mx-auto w-full max-w-page px-[var(--gutter)] pb-8 pt-7">
      <PageHeader eyebrow="Directory" title="Products" intro="Public products from HAMXELL CORE." />
      <div className="mt-7"><ProductDirectory products={products} /></div>
    </section>
  );
}
