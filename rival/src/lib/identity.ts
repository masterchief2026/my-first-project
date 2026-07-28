export type IdentityUser = {
  display_name: string | null;
  username?: string | null;
  display_style?: string | null;
  email?: string | null;
};

export function formatDisplayName(u: IdentityUser | null | undefined, fallback = 'Athlete'): string {
  if (!u) return fallback;
  const realName = u.display_name || (u.email ? u.email.split('@')[0] : '') || fallback;
  const style = u.display_style || 'real_name_username';

  if (style === 'username_only' && u.username) return `@${u.username}`;

  if (style === 'first_last_initial' && u.display_name) {
    const parts = u.display_name.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  }

  return realName;
}

// Secondary line shown under the primary name — only for the default style.
export function formatUsernameSuffix(u: IdentityUser | null | undefined): string | null {
  if (!u) return null;
  const style = u.display_style || 'real_name_username';
  return style === 'real_name_username' && u.username ? `@${u.username}` : null;
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(username);
}
