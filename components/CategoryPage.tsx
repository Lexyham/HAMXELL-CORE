import PageHeader from '@/components/PageHeader';
import ProductDirectory from '@/components/ProductDirectory';
import { listPublic } from '@/lib/projects';
import type { Category } from '@/lib/products';

/** Shared layout for the Experiments and Labs directories. */
export default async function CategoryPage({ category, eyebrow, title, intro }: { category: Category; eyebrow: string; title: string; intro: string }) {
  const items = await listPublic({ category });
  return (
    <section className="mx-auto w-full max-w-page px-[var(--gutter)] pb-8 pt-7">
      <PageHeader eyebrow={eyebrow} title={title} intro={intro} />
      <div className="mt-7"><ProductDirectory products={items} emptyText={`Nothing has been published under ${title} yet.`} /></div>
    </section>
  );
}
