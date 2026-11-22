/**
 * Editable homepage content. Edit this file; no other code needs to change.
 * Social links appear in the hero and footer only when an address is filled in.
 */
export const SOCIAL: { label: string; href: string }[] = [
  // { label: 'GitHub', href: 'https://github.com/your-name' },
  // { label: 'LinkedIn', href: 'https://www.linkedin.com/in/your-name' },
];

export const ROLES = ['websites and web apps', 'systems and CRM workflows', 'AI and automation'];

export const SERVICES = [
  { title: 'Websites and web apps', text: 'Fast, accessible sites and applications, from marketing sites to full products, built with Next.js and TypeScript.', points: ['Marketing and product sites', 'Web applications and dashboards', 'Performance and accessibility as defaults'] },
  { title: 'Systems and CRM', text: 'Internal systems that replace spreadsheets and scattered tools: customer records, workflows, approvals and reporting.', points: ['Customer and project records', 'Workflows and approvals', 'Reporting and audit trails'] },
  { title: 'AI and automation', text: 'Practical AI features and automations: assistants grounded in your own documents, integrations and background jobs.', points: ['Assistants that answer from your documents', 'Integrations between systems', 'Scheduled and background automation'] },
];

export const PROCESS = [
  { title: 'Ideas', text: 'We start with the problem, the people who have it and what success would look like, before choosing any technology.' },
  { title: 'Code', text: 'Small, reviewed steps in a typed codebase, with the data model, security and documentation decided early rather than bolted on.' },
  { title: 'Ship', text: 'Release, observe and improve. Every public product has its own page, documentation and licence, and an honest status.' },
];

export const SKILLS = ['Frontend engineering', 'Backend and APIs', 'Databases and data pipelines', 'Authentication and security', 'AI features and retrieval', 'Automation and integrations', 'Deployment and operations'];
export const STACK = ['Next.js', 'TypeScript', 'Tailwind CSS', 'Supabase (Postgres)', 'MongoDB', 'Redis', 'TiDB', 'GSAP'];
