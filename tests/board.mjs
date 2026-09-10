/* Unit tests for the shared board's ranking and validation rules.
   These need no browser and no Blobs store:

     node tests/board.mjs

   The end-to-end path (Blobs, conditional writes, rate limiting) is
   covered by running `netlify dev` and exercising /api/scores.          */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_TEAM, KEEP, PLAYER_MAX, TEAM_MAX,
  byRank, cleanName, place, toEntry, validate
} from '../netlify/functions/lib/board.mjs';

const run = (over = {}) => ({ team: 'REDS', player: 'SAM', score: 500, time: 30, ...over });

test('names are trimmed to the character set the game accepts', () => {
  assert.equal(cleanName('  Sam <script>  ', PLAYER_MAX), 'Sam script');
  assert.equal(cleanName('a'.repeat(40), TEAM_MAX).length, TEAM_MAX);
  assert.equal(cleanName('日本', PLAYER_MAX), '');
  assert.equal(cleanName(null, PLAYER_MAX), '');
  assert.equal(cleanName("O'Brien-Jr_1.", PLAYER_MAX), "O'Brien-Jr_1.");
});

test('a plausible run is accepted', () => {
  assert.equal(validate(run()), null);
});

test('a run with no player name is rejected', () => {
  assert.match(validate(run({ player: '  ' })), /player name/);
  assert.match(validate(run({ player: '★★★' })), /player name/);
});

test('a score that could not have been earned in the time is rejected', () => {
  assert.equal(validate(run({ score: 60000, time: 30 })), null);   /* at the ceiling */
  assert.match(validate(run({ score: 61001, time: 30 })), /not reachable/);
  assert.match(validate(run({ score: 1e9, time: 0 })), /not reachable/);
});

test('malformed numbers are rejected rather than coerced', () => {
  assert.match(validate(run({ score: 'lots' })), /score/);
  assert.match(validate(run({ score: -1 })), /score/);
  assert.match(validate(run({ time: NaN })), /time/);
  assert.match(validate(run({ time: 99999 })), /out of range/);
  assert.match(validate(null), /JSON object/);
});

test('an entry keeps only the fields the board stores', () => {
  const e = toEntry(run({ team: '', time: 30.06, score: 500.6, admin: true }), 'id-1', 1000);
  assert.deepEqual(e, {
    id: 'id-1', team: DEFAULT_TEAM, player: 'SAM', score: 501, time: 30.1, date: 1000
  });
});

test('higher scores rank first, and a tie goes to the longer run', () => {
  const rows = [
    { score: 100, time: 10, date: 1 },
    { score: 300, time: 10, date: 2 },
    { score: 300, time: 40, date: 3 }
  ].sort(byRank);
  assert.deepEqual(rows.map((r) => r.date), [3, 2, 1]);
});

test('an existing entry holds its place against an identical later one', () => {
  const older = { id: 'a', score: 300, time: 10, date: 1 };
  const { entries } = place([older], { id: 'b', score: 300, time: 10, date: 2 });
  assert.deepEqual(entries.map((e) => e.id), ['a', 'b']);
});

test('place reports where the entry landed', () => {
  const board = [
    { id: 'x', score: 900, time: 50, date: 1 },
    { id: 'y', score: 100, time: 5, date: 2 }
  ];
  assert.equal(place(board, { id: 'n', score: 500, time: 20, date: 3 }).rank, 1);
  assert.equal(place(board, { id: 'n', score: 9999, time: 60, date: 3 }).rank, 0);
  assert.equal(place([], { id: 'n', score: 1, time: 1, date: 3 }).rank, 0);
});

test('the board is trimmed, and a run that misses the cut reports rank -1', () => {
  const full = Array.from({ length: KEEP }, (_, i) => ({
    id: 's' + i, score: 1000 - i, time: 10, date: i
  }));
  const kept = place(full, { id: 'good', score: 999.5, time: 10, date: 999 });
  assert.equal(kept.entries.length, KEEP);
  assert.equal(kept.rank, 1);

  const dropped = place(full, { id: 'bad', score: 1, time: 10, date: 999 });
  assert.equal(dropped.entries.length, KEEP);
  assert.equal(dropped.rank, -1);
});

test('a missing or corrupt stored board is treated as empty', () => {
  assert.equal(place(undefined, { id: 'n', score: 5, time: 1, date: 1 }).rank, 0);
  assert.equal(place(null, { id: 'n', score: 5, time: 1, date: 1 }).entries.length, 1);
});
