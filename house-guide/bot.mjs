import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildPrompt, chatbotSetting, cleanModelReply, deterministicReplyId, hasPrivateImageEvidence, loadEnv, needsRoomImageEvidence, relevantFacts, shouldReplyToMessage, songSearch } from './lib.mjs';
import { analyzePendingImages, attachPrivateImageContext } from './vision.mjs';
import { recordActivity, recordInteraction } from './activity.mjs';
import { loadRuntimeConfig } from './runtime-config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(HERE, '.env'));

const settings = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
  pollMs: Number(process.env.POLL_INTERVAL_MS || 4000),
  settingsPollMs: Number(process.env.SETTINGS_POLL_INTERVAL_MS || 15000),
  contextMinutes: Number(process.env.ROOM_CONTEXT_MINUTES || 80),
  keepAlive: process.env.MODEL_KEEP_ALIVE || '5m',
  visionModel: process.env.VISION_MODEL || 'gemma3:4b',
  visionKeepAlive: process.env.VISION_KEEP_ALIVE || '0',
  visionPython: process.env.VISION_PYTHON || path.join(HERE, '.venv-vision', 'Scripts', 'python.exe'),
  moderatorScript: path.join(HERE, 'moderate-image.py'),
  workerSecret: process.env.VISION_WORKER_SECRET || '',
  dryRun: String(process.env.DRY_RUN || '').toLowerCase() === 'true',
};

if (!settings.supabaseUrl || !settings.supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_KEY are required in house-guide/.env');

const apiHeaders = {
  apikey: settings.supabaseKey,
  Authorization: `Bearer ${settings.supabaseKey}`,
  'Content-Type': 'application/json',
};
const songs = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'songs.json'), 'utf8'));
function loadKnowledge() {
  return Object.fromEntries(fs.readdirSync(path.join(HERE, 'knowledge')).filter(file => file.endsWith('.json')).map(file => [file, JSON.parse(fs.readFileSync(path.join(HERE, 'knowledge', file), 'utf8'))]));
}
let knowledge = loadKnowledge();
let knowledgeCheckedAt = 0;
let runtimeConfig = loadRuntimeConfig(HERE);
let runtimeConfigCheckedAt = 0;
const handled = new Set();
let busy = false;
let chatbotEnabled = true;
let chatbotChangedAt = null;
let settingsCheckedAt = 0;

function log(message, details = '') {
  console.log(`${new Date().toISOString()} ${message}${details ? ` ${details}` : ''}`);
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : null;
}

async function fetchRoom(contextMinutes = settings.contextMinutes) {
  const since = new Date(Date.now() - contextMinutes * 60_000).toISOString();
  const query = new URLSearchParams({
    created_at: `gte.${since}`,
    select: 'id,profile_id,singer_name,message,image_urls,image_states,night_key,created_at',
    order: 'created_at.asc',
    limit: '80',
  });
  return request(`${settings.supabaseUrl}/rest/v1/karaoke_chat_messages?${query}`, { headers: apiHeaders });
}

async function refreshChatbotSetting(force = false) {
  if (!force && Date.now() - settingsCheckedAt < settings.settingsPollMs) return chatbotEnabled;
  const query = new URLSearchParams({
    setting_key: 'in.(chatbot_enabled,active_drink_menu)',
    select: 'setting_key,setting_value,updated_at',
    limit: '2',
  });
  const rows = await request(`${settings.supabaseUrl}/rest/v1/karaoke_app_settings?${query}`, { headers: apiHeaders });
  const next = chatbotSetting(rows);
  if (next.enabled !== chatbotEnabled) log(next.enabled ? 'Chatbot enabled' : 'Chatbot disabled');
  chatbotEnabled = next.enabled;
  chatbotChangedAt = Number.isFinite(next.changedAt) ? next.changedAt : null;
  settingsCheckedAt = Date.now();
  return chatbotEnabled;
}

function refreshKnowledge() {
  if (Date.now() - knowledgeCheckedAt < 10_000) return;
  try {
    knowledge = loadKnowledge();
    knowledgeCheckedAt = Date.now();
  } catch (error) {
    log('Knowledge refresh failed:', error.message);
  }
}

function refreshRuntimeConfig() {
  if (Date.now() - runtimeConfigCheckedAt < 10_000) return;
  runtimeConfig = loadRuntimeConfig(HERE);
  runtimeConfigCheckedAt = Date.now();
}

async function ollamaHealth() {
  return request(`${settings.ollamaUrl}/api/tags`);
}

async function answer(source, roomMessages) {
  const query = String(source.message || '');
  const facts = relevantFacts(knowledge, query);
  const songMatches = songSearch(songs, query);
  const trace = {
    trigger: 'Explicit BCD summon matched',
    roomMessagesUsed: roomMessages.length,
    roomImagesWithPrivateContext: roomMessages.filter(row => Array.isArray(row.private_image_captions) && row.private_image_captions.some(Boolean)).length,
    factsUsed: facts,
    songMatches: songMatches.map(song => ({ title: song.title, artist: song.artist, code: song.code })),
    modelCalls: [],
  };
  if (needsRoomImageEvidence(query) && !hasPrivateImageEvidence(roomMessages)) {
    trace.route = 'Safety response: image question had no private image context';
    return { content: `I can't currently see that room image. Please repost it and tag @BCD again, and I'll take a look.`, trace };
  }
  const prompt = buildPrompt({
    source,
    roomMessages,
    facts,
    songs: songMatches,
  });
  const generate = async (extraInstruction = '', numPredict = 320) => {
    const started = Date.now();
    try {
      const result = await request(`${settings.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model,
      stream: false,
      think: false,
      keep_alive: settings.keepAlive,
      messages: [
        { role: 'system', content: `/no_think\n${prompt.system}\nReturn only the final guest-facing answer; never show analysis or hidden reasoning.` },
        { role: 'user', content: `/no_think\n${prompt.user}${extraInstruction}` },
      ],
      options: { temperature: 0.25, top_p: 0.8, num_ctx: 8192, num_predict: numPredict, repeat_penalty: 1.08 },
    }),
      });
      trace.modelCalls.push({ purpose: extraInstruction ? 'compact rewrite' : 'guest reply', model: result?.model || settings.model, latencyMs: Date.now() - started, outcome: 'success' });
      recordActivity({ type: 'ollama_text', model: result?.model || settings.model, outcome: 'success', latencyMs: Date.now() - started });
      return result;
    } catch (error) {
      trace.modelCalls.push({ purpose: extraInstruction ? 'compact rewrite' : 'guest reply', model: settings.model, latencyMs: Date.now() - started, outcome: 'error', error: error.message });
      recordActivity({ type: 'ollama_text', model: settings.model, outcome: 'error', latencyMs: Date.now() - started, error: error.message });
      throw error;
    }
  };
  let result = await generate();
  if (result?.done_reason === 'length') {
    const draft = cleanModelReply(result?.message?.content);
    log('Model reached its reply limit; rewriting compactly');
    result = await generate(`\n\nINCOMPLETE DRAFT:\n${draft}\n\nRewrite this as a complete answer under 450 characters. Keep the useful facts, finish every item, and do not trail off.`, 240);
  }
  const rawContent = String(result?.message?.content || '').trim();
  const finalContent = rawContent.includes('</think>') ? rawContent.split('</think>').pop() : rawContent;
  const content = cleanModelReply(finalContent, { limited: result?.done_reason === 'length' });
  if (!content) throw new Error('The local model returned an empty answer');
  trace.route = result?.done_reason === 'length' ? 'Model reply was compacted after reaching its reply limit' : 'Local model reply';
  return { content, trace };
}

async function postReply(source, message) {
  const row = {
    id: deterministicReplyId(source.id),
    profile_id: 'bcd-house-guide',
    singer_name: 'Alfie',
    message,
    image_urls: [],
    night_key: source.night_key,
  };
  if (settings.dryRun) return log('DRY RUN reply:', JSON.stringify(row));
  try {
    await request(`${settings.supabaseUrl}/rest/v1/karaoke_chat_messages`, {
      method: 'POST',
      headers: { ...apiHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
  } catch (error) {
    if (String(error.message).includes('duplicate key')) return;
    throw error;
  }
}

async function cycle() {
  if (busy) return;
  busy = true;
  try {
    refreshKnowledge();
    refreshRuntimeConfig();
    const enabled = await refreshChatbotSetting();
    let room = await fetchRoom(runtimeConfig.bot.contextMinutes);
    if (settings.workerSecret) {
      await analyzePendingImages({ room, settings: { ...settings, runtimeConfig }, log });
      room = await attachPrivateImageContext({ room, settings });
    }
    if (!enabled) return;
    const existingIds = new Set(room.map(row => row.id));
    const candidates = room.filter(row => shouldReplyToMessage(row, runtimeConfig.bot));
    for (const source of candidates) {
      if (chatbotChangedAt && Date.parse(source.created_at) < chatbotChangedAt) continue;
      const replyId = deterministicReplyId(source.id);
      if (handled.has(source.id) || existingIds.has(replyId)) continue;
      handled.add(source.id);
      log('Summoned by', `${source.singer_name}: ${String(source.message).slice(0, 120)}`);
      const replyStarted = Date.now();
      try {
        const result = await answer(source, room);
        const message = result.content;
        if (!(await refreshChatbotSetting(true))) {
          log('Reply discarded because the chatbot was turned off');
          continue;
        }
        await postReply(source, message);
        recordActivity({ type: 'bot_reply', model: settings.model, outcome: 'success', latencyMs: Date.now() - replyStarted });
        recordInteraction({
          type: 'chat_reply',
          outcome: 'success',
          model: settings.model,
          latencyMs: Date.now() - replyStarted,
          input: { singer: source.singer_name, message: source.message, imageUrls: source.image_urls || [] },
          output: message,
          trace: result.trace,
        });
        log('Replied', message);
      } catch (error) {
        handled.delete(source.id);
        recordActivity({ type: 'bot_reply', model: settings.model, outcome: 'error', latencyMs: Date.now() - replyStarted, error: error.message });
        recordInteraction({ type: 'chat_reply', outcome: 'error', model: settings.model, latencyMs: Date.now() - replyStarted, input: { singer: source.singer_name, message: source.message, imageUrls: source.image_urls || [] }, error: error.message });
        log('Reply failed:', error.message);
      }
    }
  } catch (error) {
    log('Polling failed:', error.message);
  } finally {
    busy = false;
  }
}

async function main() {
  if (process.argv.includes('--health')) {
    const [tags, room, enabled] = await Promise.all([ollamaHealth(), fetchRoom(), refreshChatbotSetting(true)]);
    const installed = (tags.models || []).map(model => model.name);
    const textReady = installed.some(name => name.startsWith(settings.model.split(':')[0]));
    const visionReady = installed.some(name => name.startsWith(settings.visionModel.split(':')[0]));
    console.log(JSON.stringify({ ok: textReady && visionReady && Boolean(settings.workerSecret), model: settings.model, visionModel: settings.visionModel, visionReady, workerConfigured: Boolean(settings.workerSecret), installed, chatbotEnabled: enabled, recentChatRows: room.length }, null, 2));
    return;
  }
  log('Starting BCD House Guide', `model=${settings.model} vision=${settings.visionModel} context=${settings.contextMinutes}m poll=${settings.pollMs}ms settings=${settings.settingsPollMs}ms${settings.workerSecret ? '' : ' VISION-NOT-CONFIGURED'}${settings.dryRun ? ' DRY-RUN' : ''}`);
  recordActivity({ type: 'bot_lifecycle', model: settings.model, outcome: 'started', note: 'Bot started and is polling for tagged messages.' });
  await cycle();
  if (process.argv.includes('--once')) return;
  setInterval(cycle, Math.max(2000, settings.pollMs));
}

process.on('unhandledRejection', error => log('Unhandled error:', error?.stack || error));
process.on('SIGINT', () => process.exit(0));
await main();
