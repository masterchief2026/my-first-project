export type Level = {
  level: number;
  name: string;
  minXp: number;
  maxXp: number;
  color: string;
  icon: string; // placeholder until proper images are added
};

export const LEVELS: Level[] = [
  { level: 1,  name: 'Rookie',    minXp: 0,      maxXp: 200,      color: '#6b7280', icon: '🌱' },
  { level: 2,  name: 'Hustler',   minXp: 200,    maxXp: 600,      color: '#06b6d4', icon: '🔥' },
  { level: 3,  name: 'Warrior',   minXp: 600,    maxXp: 1500,     color: '#2563eb', icon: '⚔️' },
  { level: 4,  name: 'Elite',     minXp: 1500,   maxXp: 3000,     color: '#059669', icon: '💎' },
  { level: 5,  name: 'Champion',  minXp: 3000,   maxXp: 6000,     color: '#d97706', icon: '🏅' },
  { level: 6,  name: 'Legend',    minXp: 6000,   maxXp: 12000,    color: '#dc2626', icon: '👑' },
  { level: 7,  name: 'Mythic',    minXp: 12000,  maxXp: 22000,    color: '#db2777', icon: '🌟' },
  { level: 8,  name: 'Immortal',  minXp: 22000,  maxXp: 40000,    color: '#4f46e5', icon: '♾️' },
  { level: 9,  name: 'God',       minXp: 40000,  maxXp: 75000,    color: '#f97316', icon: '⚡' },
  { level: 10, name: 'Unrivaled', minXp: 75000,  maxXp: Infinity, color: '#fbbf24', icon: '🏆' },
];

export function getLevel(xp: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) return LEVELS[i];
  }
  return LEVELS[0];
}

export function xpProgressInLevel(xp: number): { current: number; needed: number; pct: number } {
  const lvl = getLevel(xp);
  if (lvl.maxXp === Infinity) return { current: xp - lvl.minXp, needed: 0, pct: 1 };
  const current = xp - lvl.minXp;
  const needed = lvl.maxXp - lvl.minXp;
  return { current, needed, pct: current / needed };
}
