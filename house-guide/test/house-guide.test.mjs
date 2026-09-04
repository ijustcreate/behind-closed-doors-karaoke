import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, chatbotSetting, cleanModelReply, compactRoom, deterministicReplyId, hasPrivateImageEvidence, isSummon, needsRoomImageEvidence, relevantFacts, shouldReplyToMessage, songSearch, stripSummon } from '../lib.mjs';
import { combineSafetyVerdicts, moderationVerdict } from '../vision.mjs';

test('only explicit house-guide summons trigger', () => {
  assert.equal(isSummon('@BCD do we have Wonderwall?'), true);
  assert.equal(isSummon('Hey BCD, who mentioned a duet?'), true);
  assert.equal(isSummon('Hello BCD :)'), true);
  assert.equal(isSummon('Ask BCD: what is on the menu?'), true);
  assert.equal(isSummon('Hey Alfie, what is playing tonight?'), true);
  assert.equal(isSummon('@Alfie what can we sing?'), true);
  assert.equal(isSummon('Hiya Alfie'), true);
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
  assert.equal(stripSummon('Hey Alfie, what can we sing?'), 'what can we sing?');
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

test('private image descriptions become bot-only room context', () => {
  const compact = compactRoom([{
    singer_name: 'A',
    message: 'look at this',
    image_urls: ['data:image/jpeg;base64,abc'],
    private_image_captions: ['A cocktail menu listing a Vino Colada.'],
    created_at: '2026-08-30T01:00:00Z',
  }]);
  assert.match(compact, /PRIVATE IMAGE CONTEXT: A cocktail menu/);
  assert.doesNotMatch(compact, /description pending/);
});

test('room-image questions require actual private visual evidence', () => {
  assert.equal(needsRoomImageEvidence('@BCD what do these posted images look like?'), true);
  assert.equal(needsRoomImageEvidence('@BCD what does the BCD logo look like?'), false);
  assert.equal(hasPrivateImageEvidence([{ image_urls: ['photo.jpg'], private_image_captions: [] }]), false);
  assert.equal(hasPrivateImageEvidence([{ private_image_captions: ['A gold microphone on a dark background.'] }]), true);
  const prompt = buildPrompt({
    source: { singer_name: 'Felix', message: '@BCD what is this image?' },
    roomMessages: [],
    facts: [],
    songs: [],
  });
  assert.match(prompt.user, /VISUAL EVIDENCE AVAILABLE: NO/);
  assert.match(prompt.system, /Never describe a room image unless/);
});

test('explicit detections drive a reversible sensitive-media warning', () => {
  assert.equal(moderationVerdict([{ class: 'FEMALE_BREAST_EXPOSED', score: 0.8 }]).status, 'sensitive');
  assert.equal(moderationVerdict([{ class: 'FEMALE_BREAST_EXPOSED', score: 0.22 }]).status, 'unknown');
  assert.equal(moderationVerdict([{ class: 'FACE_FEMALE', score: 0.99 }]).status, 'safe');
});

test('confirmed graphic violence is treated as sensitive while uncertain checks are not', () => {
  assert.equal(combineSafetyVerdicts(moderationVerdict([]), { explicitSexual: false, graphicViolence: true }).status, 'sensitive');
  assert.equal(combineSafetyVerdicts(moderationVerdict([]), { explicitSexual: false, graphicViolence: false }).status, 'safe');
});

test('fact retrieval prefers relevant approved facts', () => {
  const facts = relevantFacts({ venue: { address: '2041 Pacific Avenue' }, drinks: ['Vino Colada'] }, 'Where is the address?');
  assert.match(facts[0], /2041 Pacific Avenue/);
});
