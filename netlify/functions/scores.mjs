/* ============================================================
   scores.mjs — the global leaderboard, backed by Netlify Blobs

   GET  /api/scores?limit=10
        -> { entries: [...], total: n }
   POST /api/scores   { team, player, score, time }
        -> { entries: [...], rank: n, id: "...", total: n }

   Blobs is a key-value store, not a database, so the whole board lives
   under one key as a sorted JSON array. That is fine at leaderboard
   scale (a hundred rows) and it keeps ranking to a single read.

   The ranking and validation rules live in lib/board.mjs so they can be
   tested without a store; everything here is I/O.
   ============================================================ */
import { getStore } from '@netlify/blobs';
import { KEEP, place, toEntry, validate } from './lib/board.mjs';

const STORE_NAME = 'unhammered';
const BOARD_KEY = 'leaderboard/v1';

const DEFAULT_LIMIT = 10;      /* rows returned when the caller doesn't say */
const MAX_LIMIT = KEEP;

/* Read-modify-write on one key races when two players finish together, so
   writes are conditional on the etag we read and retried on conflict. */
const WRITE_ATTEMPTS = 5;

/* Per-IP write budget. Enough for a machine a team is taking turns on,
   far short of a script. */
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_WRITES = 12;

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

function clientIp(req, context) {
  return req.headers.get('x-nf-client-connection-ip') || context?.ip || 'unknown';
}

async function readBoard(blobs) {
  const found = await blobs.getWithMetadata(BOARD_KEY, { type: 'json' });
  return {
    entries: Array.isArray(found?.data) ? found.data : [],
    /* Absent means the key isn't there yet, which is a different write
       condition from "there but unchanged". */
    exists: found !== null && found !== undefined,
    etag: found?.etag
  };
}

/* True when the write landed. `modified: false` means someone else wrote
   between our read and our write, so the caller re-reads and re-ranks. */
async function writeBoard(blobs, entries, read) {
  let options;
  if (!read.exists) {
    options = { onlyIfNew: true };
  } else if (read.etag) {
    options = { onlyIfMatch: read.etag };
  } else {
    /* The local Blobs sandbox serves reads without an ETag, so there is
       nothing to make the write conditional on. Last write wins, which is
       fine for one developer and never happens against the real store. */
    options = {};
  }
  const result = await blobs.setJSON(BOARD_KEY, entries, options);
  return result?.modified !== false;
}

/* Sliding window per IP, kept in the same store. Fails open: a rate-limit
   read that errors must not stop someone filing a legitimate score. */
async function overRateLimit(blobs, ip) {
  const key = `ratelimit/${encodeURIComponent(ip)}`;
  const now = Date.now();
  try {
    const found = await blobs.getWithMetadata(key, { type: 'json' });
    const recent = (Array.isArray(found?.data) ? found.data : [])
      .filter((t) => typeof t === 'number' && now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX_WRITES) return true;
    recent.push(now);
    await blobs.setJSON(key, recent);
    return false;
  } catch {
    return false;
  }
}

async function handleGet(req, blobs) {
  const asked = Number(new URL(req.url).searchParams.get('limit'));
  const limit = Number.isFinite(asked) && asked > 0 ? Math.min(asked, MAX_LIMIT) : DEFAULT_LIMIT;
  const { entries } = await readBoard(blobs);
  return json({ entries: entries.slice(0, limit), total: entries.length });
}

async function handlePost(req, context, blobs) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'malformed JSON body' }, 400);
  }

  const problem = validate(body);
  if (problem) return json({ error: problem }, 400);

  if (await overRateLimit(blobs, clientIp(req, context))) {
    return json({ error: 'too many scores from this address — try again shortly' }, 429);
  }

  const entry = toEntry(body, crypto.randomUUID(), Date.now());

  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    const current = await readBoard(blobs);
    const placed = place(current.entries, entry);

    if (await writeBoard(blobs, placed.entries, current)) {
      return json({
        entries: placed.entries.slice(0, DEFAULT_LIMIT),
        /* -1 when the run was good enough to submit but not to survive the
           trim — the client says "not in the top 100" rather than a rank. */
        rank: placed.rank,
        id: entry.id,
        total: placed.entries.length
      });
    }
  }

  return json({ error: 'the board is busy — try again' }, 503);
}

export default async (req, context) => {
  const blobs = getStore({ name: STORE_NAME, consistency: 'strong' });

  try {
    if (req.method === 'GET') return await handleGet(req, blobs);
    if (req.method === 'POST') return await handlePost(req, context, blobs);
    return json({ error: 'method not allowed' }, 405, { allow: 'GET, POST' });
  } catch (err) {
    /* The game treats any failure as "offline" and falls back to the local
       board, so a broken store costs the global list, not the run. */
    console.error('scores function failed', err);
    return json({ error: 'leaderboard unavailable' }, 502);
  }
};

export const config = { path: '/api/scores' };
