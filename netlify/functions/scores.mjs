/* ============================================================
   scores.mjs — the global leaderboard, backed by Netlify Blobs

   GET    /api/scores?limit=10
          -> { entries: [...], total: n }
   POST   /api/scores   { team, player, score, time }
          -> { entries: [...], rank: n, id: "...", total: n }
   DELETE /api/scores?id=<id>   |   DELETE /api/scores?all=1
          -> { entries: [...], removed: n, total: n }

   The two DELETEs are the admin page at /admin, and are the only thing
   here that needs a credential: an ADMIN_TOKEN environment variable,
   sent back as an x-admin-token header. With no ADMIN_TOKEN set they
   are refused outright, so a site that never configures one has no
   delete path at all.

   Blobs is a key-value store, not a database, so the whole board lives
   under one key as a sorted JSON array. That is fine at leaderboard
   scale (a hundred rows) and it keeps ranking to a single read.

   The ranking and validation rules live in lib/board.mjs so they can be
   tested without a store; everything here is I/O.
   ============================================================ */
import { timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { KEEP, place, removeById, toEntry, validate } from './lib/board.mjs';

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

/* Wrong admin tokens get their own window and their own key. Sharing the
   submitters' bucket would mean someone guessing tokens could lock every
   player behind the same NAT out of filing a score. */
const RATE_MAX_BAD_TOKENS = 5;

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

/* 'ok' | 'denied' | 'unconfigured'. Compared in constant time: a plain
   === leaks the correct prefix to anyone willing to measure. The length
   check leaks the token's length, which is not worth contorting for. */
function checkToken(req) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return 'unconfigured';

  const given = Buffer.from(req.headers.get('x-admin-token') || '', 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  if (given.length !== wanted.length) return 'denied';
  return timingSafeEqual(given, wanted) ? 'ok' : 'denied';
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

/* Sliding window per IP per bucket, kept in the same store. Fails open: a
   rate-limit read that errors must not stop someone filing a legitimate
   score, and must not lock an admin out of their own board either. */
async function overRateLimit(blobs, bucket, ip, budget) {
  const key = `ratelimit/${bucket}/${encodeURIComponent(ip)}`;
  const now = Date.now();
  try {
    const found = await blobs.getWithMetadata(key, { type: 'json' });
    const recent = (Array.isArray(found?.data) ? found.data : [])
      .filter((t) => typeof t === 'number' && now - t < RATE_WINDOW_MS);
    if (recent.length >= budget) return true;
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

  if (await overRateLimit(blobs, 'submit', clientIp(req, context), RATE_MAX_WRITES)) {
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

/* Wipes the board, or drops a single row by id. Both are conditional and
   retried for the same reason a submit is: an admin tidying the board and
   a player finishing a run are exactly the collision to worry about. */
async function handleDelete(req, context, blobs) {
  const verdict = checkToken(req);
  if (verdict === 'unconfigured') {
    return json({ error: 'no ADMIN_TOKEN is set on this site' }, 503);
  }

  if (verdict !== 'ok') {
    /* Recorded on the way out, so a run of guesses actually stops rather
       than just being counted. A correct token is never rate limited: the
       admin page loads and deletes freely once it is holding one. */
    const over = await overRateLimit(blobs, 'admin', clientIp(req, context), RATE_MAX_BAD_TOKENS);
    return over
      ? json({ error: 'too many failed attempts — try again shortly' }, 429)
      : json({ error: 'not authorised' }, 401);
  }

  const params = new URL(req.url).searchParams;
  const id = params.get('id');
  const all = params.get('all') === '1';

  if (all) {
    const before = await readBoard(blobs);
    await blobs.delete(BOARD_KEY);
    /* A missing key reads back as an empty board, so deleting the key is
       the whole reset — there is no empty-array to write afterwards. */
    return json({ entries: [], removed: before.entries.length, total: 0 });
  }

  if (!id) return json({ error: 'pass ?id=<id> or ?all=1' }, 400);

  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    const current = await readBoard(blobs);
    const cut = removeById(current.entries, id);
    if (!cut.removed) return json({ error: 'no score with that id' }, 404);

    if (await writeBoard(blobs, cut.entries, current)) {
      return json({ entries: cut.entries, removed: 1, total: cut.entries.length });
    }
  }

  return json({ error: 'the board is busy — try again' }, 503);
}

export default async (req, context) => {
  const blobs = getStore({ name: STORE_NAME, consistency: 'strong' });

  try {
    if (req.method === 'GET') return await handleGet(req, blobs);
    if (req.method === 'POST') return await handlePost(req, context, blobs);
    if (req.method === 'DELETE') return await handleDelete(req, context, blobs);
    return json({ error: 'method not allowed' }, 405, { allow: 'GET, POST, DELETE' });
  } catch (err) {
    /* The game treats any failure as "offline" and falls back to the local
       board, so a broken store costs the global list, not the run. */
    console.error('scores function failed', err);
    return json({ error: 'leaderboard unavailable' }, 502);
  }
};

export const config = { path: '/api/scores' };
