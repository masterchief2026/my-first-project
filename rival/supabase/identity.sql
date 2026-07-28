-- Real name + optional username identity system. See
-- project_rival_identity_naming.md — real name stays the required primary
-- identity (signup is unchanged); username is optional and set later from
-- profile settings. display_style controls how OTHER users see this
-- person's name across the app.

alter table users add column username text unique;
alter table users add column display_style text not null default 'real_name_username';

alter table users add constraint username_format_check
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

alter table users add constraint display_style_check
  check (display_style in ('real_name_username', 'username_only', 'first_last_initial'));
