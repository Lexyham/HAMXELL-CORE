export const DOCS_PROMPT_VERSION = 'docs.v1';

export const DOC_KINDS = ['readme', 'user-guide', 'features', 'technical'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_TITLE: Record<DocKind, string> = {
  readme: 'README',
  'user-guide': 'User guide',
  features: 'Features',
  technical: 'Technical overview',
};

export const DOCS_SYSTEM = `You write project documentation for HAMXELL CORE, a technology laboratory.
Voice: corporate, precise, technical, understated. No hype, no marketing superlatives, no emojis, no exclamation marks.
Honesty rules, which are absolute:
- Use only the facts in the supplied project context. Never invent features, users, metrics, endpoints, integrations or architecture.
- Where the context does not say, write "Not provided." rather than guessing.
- Keep the labels [observed] and [inferred] exactly where the context uses them. Mark any conclusion you draw yourself as [inferred].
- Do not mention or request credentials, keys or passwords.
Output Markdown only, starting with a level-1 heading. No preamble and no closing remarks.`;

const SHAPE: Record<DocKind, string> = {
  readme: 'a README: title, one-paragraph summary, status, a short "What it does" section, a "Technology" section, links, and licence.',
  'user-guide': 'a user guide: who it is for, how to get started, the main areas of the interface, and common tasks. Only describe tasks the context supports; otherwise state that step-by-step workflows are not provided.',
  features: 'a features document: a concise list of capabilities, each with one sentence of explanation, grouped logically. Label each feature [observed] or [inferred].',
  technical: 'a technical overview: technology stack, hosting and delivery signals, and an explicit section listing what is not known (backend, database, APIs, deployment) so the owner can fill it in.',
};

export const docPrompt = (kind: DocKind, context: string) =>
  `Write ${SHAPE[kind]}\n\nProject context:\n---\n${context}\n---`;
