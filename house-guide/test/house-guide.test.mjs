import test from 'node:test';
import assert from 'node:assert/strict';
import { compactRoom, deterministicReplyId, isSummon, relevantFacts, shouldReplyToMessage, songSearch, stripSummon } from '../lib.mjs';

test('only explicit house-guide summons trigger', () => {
  assert.equal(isSummon('@BCD do we have Wonderwall?'), true);
  assert.equal(isSummon('Hey BCD, who mentioned a duet?'), true);
  assert.equal(isSummon('Hello BCD :)'), true);
  assert.equal(isSummon('Ask BCD: what is on the menu?'), true);
  assert.equal(isSummon('I love the BCD Old Fashioned'), false);
  assert.equal(isSummon('BCD was busy tonight'), false);
  assert.equal(isSummon('normal room chat'), false);
});

test('the guide never initiates or replies to ordinary room chat', () => {
  assert.equal(shouldReplyToMessage({ profile_id: 'member-1', message: 'What is everyone singing?' }), false);
  assert.equal(shouldReplyToMessage({ profile_id: 'bcd-house-guide', message: '@BCD talk to yourself' }), false);
  assert.equal(shouldReplyToMessage({ profile_id: 'member-1', message: '@BCD what is on the menu?' }), true);
});

test('summon is removed from the user question', () => {
  assert.equal(stripSummon('@BCD, do we have Wonderwall?'), 'do we have Wonderwall?');
});

test('reply IDs are stable and distinct', () => {
  assert.equal(deterministicReplyId('one'), deterministicReplyId('one'));
  assert.notEqual(deterministicReplyId('one'), deterministicReplyId('two'));
});

test('song retrieval favors exact title matches', () => {
  const songs = [
    { title: 'Wonderwall', artist: 'Oasis', code: '7963', genre: 'Alternative' },
    { title: 'Wonderful Tonight', artist: 'Eric Clapton', code: '7099', genre: 'Pop' },
  ];
  assert.equal(songSearch(songs, 'Wonderwall')[0].code, '7963');
});

test('room compaction retains every message in order', () => {
  const room = [
    { singer_name: 'A', message: 'first', created_at: '2026-08-30T01:00:00Z' },
    { singer_name: 'B', message: 'second', created_at: '2026-08-30T01:01:00Z' },
  ];
  const compact = compactRoom(room);
  assert.ok(compact.indexOf('first') < compact.indexOf('second'));
  assert.match(compact, /A: first/);
  assert.match(compact, /B: second/);
});

test('fact retrieval prefers relevant approved facts', () => {
  const facts = relevantFacts({ venue: { address: '2041 Pacific Avenue' }, drinks: ['Vino Colada'] }, 'Where is the address?');
  assert.match(facts[0], /2041 Pacific Avenue/);
});
