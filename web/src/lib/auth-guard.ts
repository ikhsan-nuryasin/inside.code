const STORAGE_KEY = 'student-hub-auth-attempt-guard';
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 5 * 60 * 1000;

type GuardState = { email: string; failures: number; firstFailureAt: number; lockedUntil: number };

function read(email: string): GuardState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as GuardState | null;
    if (parsed?.email === email) return parsed;
  } catch { /* ignore */ }
  return { email, failures: 0, firstFailureAt: Date.now(), lockedUntil: 0 };
}
function write(value: GuardState) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* ignore */ } }
export function getAuthLock(email: string): number {
  const state = read(email);
  if (state.lockedUntil > Date.now()) return state.lockedUntil;
  if (Date.now() - state.firstFailureAt > WINDOW_MS) write({ email, failures: 0, firstFailureAt: Date.now(), lockedUntil: 0 });
  return 0;
}
export function recordAuthFailure(email: string): number {
  const now = Date.now();
  const state = read(email);
  if (now - state.firstFailureAt > WINDOW_MS) {
    const fresh = { email, failures: 1, firstFailureAt: now, lockedUntil: 0 };
    write(fresh); return 0;
  }
  const failures = state.failures + 1;
  const lockedUntil = failures >= MAX_FAILURES ? now + LOCK_MS : 0;
  write({ email, failures, firstFailureAt: state.firstFailureAt, lockedUntil });
  return lockedUntil;
}
export function clearAuthFailures(email: string) { try { const current = read(email); if (current.email === email) localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } }
export const AUTH_RATE_RULES = { maxFailures: MAX_FAILURES, windowMinutes: WINDOW_MS / 60000, localLockMinutes: LOCK_MS / 60000 };
