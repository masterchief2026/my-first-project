// Users type dates as DD/MM/YYYY; the database and every date comparison in
// the app (gte/lte on `date` columns) needs ISO YYYY-MM-DD. These convert
// between the two at the UI boundary only — never store display-format dates.

export function isoToDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

// Returns null if the input isn't a valid DD/MM/YYYY date.
export function displayToIsoDate(display: string): string | null {
  const match = display.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // Reject impossible dates (e.g. 31/02/2026) by round-tripping through Date.
  const check = new Date(year, month - 1, day);
  if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) return null;
  return iso;
}
