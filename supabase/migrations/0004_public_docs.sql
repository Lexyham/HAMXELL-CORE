-- HAMXELL CORE, Phase 5: public documentation reader. Run after 0003.
-- A document is public only when it is published AND its project is public. Unlisted, warning-gated and private
-- projects never expose documentation through the public reader.
create policy docs_public_read on public.documentation_docs for select
  using (
    status = 'published'
    and exists (select 1 from public.projects p where p.id = project_id and p.visibility = 'public')
  );
