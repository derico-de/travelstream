/**
 * The remembered trip: capture routes file to the last trip the user chose,
 * so picking once covers a whole trip's worth of captures — including
 * offline, when the trip list can't load.
 */

const KEY = 'travelstream.lastTrip';

export function rememberLastTrip(tripPath: string): void {
  if (tripPath) localStorage.setItem(KEY, tripPath);
}

export function recallLastTrip(): string {
  return localStorage.getItem(KEY) ?? '';
}

export function clearLastTrip(): void {
  localStorage.removeItem(KEY);
}
