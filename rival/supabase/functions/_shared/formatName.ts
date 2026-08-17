type IdentityUser = {
  display_name: string | null;
  username?: string | null;
  display_style?: string | null;
  email?: string | null;
};

// Mirrors rival/src/lib/identity.ts formatDisplayName — keep in sync.
export function formatDisplayName(u: IdentityUser | null | undefined, fallback = 'Someone'): string {
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

// Mirrors rival/src/lib/identity.ts formatTeamName — keep in sync.
export function formatTeamName(name: string | null | undefined): string {
  if (!name) return '';
  return name.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}
