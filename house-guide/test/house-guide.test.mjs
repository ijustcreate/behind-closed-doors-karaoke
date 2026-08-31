import test from 'node:test';
import assert from 'node:assert/strict';
import { chatbotSetting, cleanModelReply, compactRoom, deterministicReplyId, isSummon, relevantFacts, shouldReplyToMessage, songSearch, stripSummon } from '../lib.mjs';

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

test('chatbot setting is on by default and obeys the shared off switch', () => {
  assert.deepEqual(chatbotSetting([]), { enabled: true, changedAt: null });
  assert.equal(chatbotSetting([{ setting_key: 'chatbot_enabled', setting_value: false, updated_at: '2026-08-31T05:00:00Z' }]).enabled, false);
  assert.equal(chatbotSetting([{ setting_key: 'chatbot_enabled', setting_value: true, updated_at: '2026-08-31T05:01:00Z' }]).changedAt, Date.parse('2026-08-31T05:01:00Z'));
  assert.equal(chatbotSetting([{ setting_key: 'active_drink_menu', setting_value: { subheader: '[[BCD_CHATBOT:OFF]]' }, updated_at: '2026-08-31T05:02:00Z' }]).enabled, false);
  assert.equal(chatbotSetting([{ setting_key: 'active_drink_menu', setting_value: { subheader: '[[BCD_CHATBOT:ON]]Summer menu' }, updated_at: '2026-08-31T05:03:00Z' }]).enabled, true);
});

test('summon is removed from the user question', () => {
  assert.equal(stripSummon('@BCD, do we have Wonderwall?'), 'do we have Wonderwall?');
});

test('a token-limited model reply stops at its last complete sentence', () => {
  const reply = cleanModelReply('First recommendation is complete. Second recommendation trails off at a classic', { limited: true });
  assert.equal(reply, 'First recommendation is complete.');
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
