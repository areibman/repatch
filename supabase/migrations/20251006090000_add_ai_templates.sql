-- Add AI templates for summary customization and link to patch notes
create table if not exists ai_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  audience text not null default 'balanced',
  commit_prompt text not null,
  overall_prompt text not null,
  example_input text,
  example_output text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'ai_templates_audience_check'
  ) then
    alter table ai_templates
      add constraint ai_templates_audience_check
      check (audience in ('technical', 'non-technical', 'balanced'));
  end if;
end;
$$;

alter table patch_notes
  add column if not exists template_id uuid references ai_templates(id);

alter table patch_notes
  add column if not exists branch text;

create index if not exists patch_notes_template_id_idx on patch_notes(template_id);
