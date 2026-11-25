/** Feature flags. "false" means the capability is switched off; anything else (including unset) means live. */
export const flag = (name: string): boolean => process.env[name] !== 'false';

/** What each flag controls, shown read-only in Admin > Settings. Flags are environment variables: change them there and restart or redeploy. */
export const FLAGS: { name: string; summary: string; off: string; reserved?: boolean }[] = [
  { name: 'FEATURE_CHATBOT', summary: 'Public assistant that answers from published documentation.', off: 'The launcher is not shown.' },
  { name: 'FEATURE_PROJECT_IMPORTER', summary: 'Website importer: reads a public site and writes a description of it.', off: 'The importer page shows "Coming soon".' },
  { name: 'FEATURE_AI_DOC_GENERATOR', summary: 'AI documentation drafts and AI-written site descriptions.', off: 'AI generation is unavailable; manual editing still works.' },
  { name: 'FEATURE_KNOWLEDGE_ENGINE', summary: 'Private question-and-answer over all project records.', off: 'The Knowledge page shows "Coming soon".' },
  { name: 'FEATURE_WARNING_GATED_PROJECTS', summary: 'Warning-gated project pages (/p/...).', off: 'Those addresses return 404.' },
  { name: 'FEATURE_UNLISTED_PROJECTS', summary: 'Unlisted project pages (/u/...).', off: 'Those addresses return 404.' },
  { name: 'FEATURE_CREDENTIALS_VAULT', summary: 'Encrypted credentials vault.', off: 'The vault is unavailable.' },
  { name: 'FEATURE_ANALYTICS_DASHBOARD', summary: 'Cookieless analytics collection and dashboard.', off: 'Nothing is collected and the dashboard shows "Coming soon".' },
  { name: 'FEATURE_LICENSING', summary: 'Licence information on project pages and /licenses.', off: 'Licence details are hidden and /licenses shows "Coming soon".' },
  { name: 'FEATURE_PUBLIC_AI_ASSISTANT', summary: 'Reserved. Not used by the current version.', off: 'No effect.', reserved: true },
];
