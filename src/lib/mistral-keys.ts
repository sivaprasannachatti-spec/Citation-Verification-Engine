/**
 * Mistral API key pool with round-robin rotation and rate-limit failover.
 *
 * Keys are read from MISTRAL_API_KEY_1..N (and an optional comma-separated
 * MISTRAL_API_KEY). A module-level cursor advances on every acquisition so
 * consecutive requests spread across the pool instead of hammering key #1.
 */

export interface PoolKey {
  index: number;   // 1-based, matches the .env suffix
  value: string;
}

/** Keys parked until this timestamp because they returned 429. */
const cooldownUntil = new Map<number, number>();
/** Keys permanently disabled for this process (401/403 — invalid or revoked). */
const disabled = new Set<number>();

let cursor = 0;

const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 5 * 60_000;

function readPool(): PoolKey[] {
  const keys: PoolKey[] = [];

  // Numbered form: MISTRAL_API_KEY_1, _2, ... (contiguous from 1)
  for (let i = 1; ; i++) {
    const raw = process.env[`MISTRAL_API_KEY_${i}`];
    if (raw === undefined) break;
    const value = raw.trim().replace(/^['"]|['"]$/g, '');
    if (value) keys.push({ index: i, value });
  }

  // Legacy/alternative form: single var holding a comma-separated list.
  if (keys.length === 0) {
    const list = (process.env.MISTRAL_API_KEY || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    list.forEach((value, i) => keys.push({ index: i + 1, value }));
  }

  return keys;
}

export function poolSize(): number {
  return readPool().length;
}

/**
 * Returns the keys to attempt, in rotation order, skipping disabled keys and
 * those still cooling down. If every key is cooling down we return them all
 * anyway (in rotation order) rather than failing outright — a stale cooldown
 * should never make the route unavailable.
 */
export function keysToTry(): PoolKey[] {
  const pool = readPool();
  if (pool.length === 0) return [];

  const start = cursor % pool.length;
  cursor = (cursor + 1) % pool.length;

  const ordered = [...pool.slice(start), ...pool.slice(0, start)];
  const live = ordered.filter((k) => !disabled.has(k.index));
  const now = Date.now();
  const ready = live.filter((k) => (cooldownUntil.get(k.index) ?? 0) <= now);

  if (ready.length > 0) return ready;
  return live; // all cooling down: retry anyway rather than hard-fail
}

/** Park a key that returned 429. `retryAfterSec` comes from the Retry-After header. */
export function markRateLimited(index: number, retryAfterSec?: number): void {
  const ms = retryAfterSec && retryAfterSec > 0
    ? Math.min(retryAfterSec * 1000, MAX_COOLDOWN_MS)
    : DEFAULT_COOLDOWN_MS;
  cooldownUntil.set(index, Date.now() + ms);
}

/** Permanently drop a key that the API rejected as invalid (401/403). */
export function markInvalid(index: number): void {
  disabled.add(index);
}

/** A key that just worked is definitely not rate limited. */
export function markHealthy(index: number): void {
  cooldownUntil.delete(index);
}
