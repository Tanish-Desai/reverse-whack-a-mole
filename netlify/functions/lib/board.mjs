/* ============================================================
   board.mjs — ranking and validation rules for the shared board

   Kept apart from the request handler so the rules can be tested
   without a running Blobs store. Nothing in here does any I/O.
   ============================================================ */

/* Mirrors DEFAULT_TEAM / TEAM_MAX / PLAYER_MAX / NAME_CHAR in js/game.js.
   The client already enforces these; the server does not trust it. */
export const DEFAULT_TEAM = 'FREE AGENTS';
export const TEAM_MAX = 18;
export const PLAYER_MAX = 14;
const NAME_CHARS = /[^A-Za-z0-9 .'_-]/g;

/* Rows retained in the blob. The client only ever shows the top ten, but
   keeping a hundred means a run can drop off the visible board without
   being lost the moment someone better comes along. */
export const KEEP = 100;

/* A loose plausibility bound, not anti-cheat. The real ceiling is roughly
   10 pts/sec passive x15 multiplier plus close-call combos; anything past
   this is a hand-written POST, not a run. */
export const MAX_BASE_SCORE = 1000;
export const MAX_SCORE_PER_SECOND = 2000;
export const MAX_RUN_SECONDS = 3600;

export function cleanName(value, max) {
  return String(value == null ? '' : value)
    .replace(NAME_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* Highest score first; on a tie the longer run wins, and an older entry
   holds its place against a later match. Matches js/storage.js so the
   local and global boards never disagree about ordering. */
export function byRank(a, b) {
  return b.score - a.score || b.time - a.time || a.date - b.date;
}

/* Returns an error string, or null when the body is usable. */
export function validate(body) {
  if (!body || typeof body !== 'object') return 'expected a JSON object';

  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0) return 'score must be a non-negative number';

  const time = Number(body.time);
  if (!Number.isFinite(time) || time < 0) return 'time must be a non-negative number';
  if (time > MAX_RUN_SECONDS) return 'time is out of range';

  if (score > MAX_BASE_SCORE + MAX_SCORE_PER_SECOND * time) {
    return 'score is not reachable in that time';
  }

  if (!cleanName(body.player, PLAYER_MAX)) return 'a player name is required';

  return null;
}

/* Builds the stored row from a validated request body. */
export function toEntry(body, id, now) {
  return {
    id,
    team: cleanName(body.team, TEAM_MAX) || DEFAULT_TEAM,
    player: cleanName(body.player, PLAYER_MAX),
    score: Math.round(Number(body.score)),
    time: Math.round(Number(body.time) * 10) / 10,
    date: now
  };
}

/* Slots `entry` into `entries` and trims to KEEP. Returns the new board and
   the entry's 0-based place, or -1 when it did not make the cut. */
export function place(entries, entry) {
  const next = (Array.isArray(entries) ? entries : []).concat([entry]).sort(byRank).slice(0, KEEP);
  return { entries: next, rank: next.findIndex((e) => e.id === entry.id) };
}

/* Drops one row by id. `removed` is false when nothing matched, which the
   admin endpoint reports as a 404 rather than a silent success — deleting
   a row someone else already deleted should say so. */
export function removeById(entries, id) {
  const before = Array.isArray(entries) ? entries : [];
  const next = before.filter((e) => e && e.id !== id);
  return { entries: next, removed: next.length !== before.length };
}
