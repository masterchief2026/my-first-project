-- Lets users pick the tone of their daily motivational quote. See
-- project_rival_quote_tone.md — reuses the existing quotes.ts bank (each
-- quote already tagged with a tone), no new content system.

alter table users add column quote_tone text not null default 'balanced';

alter table users add constraint quote_tone_check
  check (quote_tone in ('blunt', 'balanced', 'encouraging'));
