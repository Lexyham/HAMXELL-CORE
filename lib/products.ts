export type ProjectStatus = 'in_development' | 'active' | 'experimental' | 'paused' | 'archived' | 'discontinued';
export type Visibility = 'public' | 'unlisted' | 'warning' | 'private';

export const STATUSES: ProjectStatus[] = ['in_development', 'active', 'experimental', 'paused', 'archived', 'discontinued'];
export const VISIBILITIES: Visibility[] = ['public', 'unlisted', 'warning', 'private'];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  in_development: 'In development',
  active: 'Active',
  experimental: 'Experimental',
  paused: 'Paused',
  archived: 'Archived',
  discontinued: 'Discontinued',
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  warning: 'Warning-gated',
  private: 'Private',
};

export type Category = 'product' | 'experiment' | 'lab';
export const CATEGORIES: Category[] = ['product', 'experiment', 'lab'];
export const CATEGORY_LABEL: Record<Category, string> = { product: 'Product', experiment: 'Experiment', lab: 'Lab' };

export interface Product {
  id?: string;
  slug: string;
  name: string;
  summary: string;
  description?: string;
  status: ProjectStatus;
  visibility: Visibility;
  category?: Category;
  tags: string[];
  launchUrl?: string | null;
  warningText?: string | null;
  licenceType?: string | null;
  licenceText?: string | null;
  licenceUrl?: string | null;
  featured?: boolean;
  placeholder?: boolean;
}

/** Shown only while Supabase is not configured, so the public site runs locally with no keys. */
export const PLACEHOLDERS: Product[] = [
  { slug: 'web-platform', name: 'Web Platform', summary: 'Placeholder entry for a website or web application. Replace with a real project.', status: 'active', visibility: 'public', category: 'product', tags: ['Next.js', 'TypeScript'], placeholder: true },
  { slug: 'crm-system', name: 'CRM System', summary: 'Placeholder entry for a business system or CRM workflow. Replace with a real project.', status: 'in_development', visibility: 'public', category: 'product', tags: ['Postgres', 'Workflows'], placeholder: true },
  { slug: 'automation-engine', name: 'Automation Engine', summary: 'Placeholder entry for an automation or integration product. Replace with a real project.', status: 'experimental', visibility: 'public', category: 'product', tags: ['Queues', 'Integrations'], placeholder: true },
  { slug: 'ai-assistant', name: 'AI Assistant', summary: 'Placeholder entry for an AI product. Replace with a real project.', status: 'experimental', visibility: 'public', category: 'product', tags: ['LLM', 'Retrieval'], placeholder: true },
];
