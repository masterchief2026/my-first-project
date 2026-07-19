export function getCurrentSeasonYear(): number {
  return new Date().getFullYear();
}

export function getSeasonStartISO(year: number = getCurrentSeasonYear()): string {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0)).toISOString();
}

export function getSeasonEndISO(year: number = getCurrentSeasonYear()): string {
  return new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)).toISOString();
}

export function daysUntilSeasonEnd(): number {
  const now = new Date();
  const end = new Date(getSeasonEndISO());
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
