import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildPrompt, deterministicReplyId, loadEnv, relevantFacts, shouldReplyToMessage, songSearch } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(HERE, '.env'));

const settings = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
  pollMs: Number(process.env.POLL_INTERVAL_MS || 4000),
  contextMinutes: Number(process.env.ROOM_CONTEXT_MINUTES || 80),
  keepAlive: process.env.MODEL_KEEP_ALIVE || '5m',
  dryRun: String(process.env.DRY_RUN || '').toLowerCase() === 'true',
};

if (!settings.supabaseUrl || !settings.supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_KEY are required in house-guide/.env');

const apiHeaders = {
  apikey: settings.supabaseKey,
  Authorization: `Bearer ${settings.supabaseKey}`,
  'Content-Type': 'application/json',
};
const songs = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'songs.json'), 'utf8'));
const knowledge = Object.fromEntries(fs.readdirSync(path.join(HERE, 'knowledge')).filter(file => file.endsWith('.json')).map(file => [file, JSON.parse(fs.readFileSync(path.join(HERE, 'knowledge', file), 'utf8'))]));
const handled = new Set();
let busy = false;

function log(message, details = '') {
  console.log(`${new Date().toISOString()} ${message}${details ? ` ${details}` : ''}`);
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : null;
}

async function fetchRoom() {
  const since = new Date(Date.now() - settings.contextMinutes * 60_000).toISOString();
  const query = new URLSearchParams({
    created_at: `gte.${since}`,
    select: 'id,profile_id,singer_name,message,image_urls,night_key,created_at',
    order: 'created_at.asc',
    limit: '80',
  });
  return request(`${settings.supabaseUrl}/rest/v1/karaoke_chat_messages?${query}`, { headers: apiHeaders });
}

async function ollamaHealth() {
  return request(`${settings.ollamaUrl}/api/tags`);
}

async function answer(source, roomMessages) {
  const query = String(source.message || '');
  const prompt = buildPrompt({
    source,
    roomMessages,
    facts: relevantFacts(knowledge, query),
    songs: songSearch(songs, query),
  });
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
        { role: 'user', content: `/no_think\n${prompt.user}` },
      ],
      options: { temperature: 0.25, top_p: 0.8, num_ctx: 8192, num_predict: 120, repeat_penalty: 1.08 },
    }),
  });
  const rawContent = String(result?.message?.content || '').trim();
  const content = (rawContent.includes('</think>') ? rawContent.split('</think>').pop() : rawContent)
    .replace(/^<think>[\s\S]*?<\/think>\s*/i, '')
    .trim()
    .slice(0, 1000);
  if (!content) throw new Error('The local model returned an empty answer');
  return content;
}

async function postReply(source, message) {
  const row = {
    id: deterministicReplyId(source.id),
    profile_id: 'bcd-house-guide',
    singer_name: 'BCD Host',
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
    const room = await fetchRoom();
    const existingIds = new Set(room.map(row => row.id));
    const candidates = room.filter(shouldReplyToMessage);
    for (const source of candidates) {
      const replyId = deterministicReplyId(source.id);
      if (handled.has(source.id) || existingIds.has(replyId)) continue;
      handled.add(source.id);
      log('Summoned by', `${source.singer_name}: ${String(source.message).slice(0, 120)}`);
      try {
        const message = await answer(source, room);
        await postReply(source, message);
        log('Replied', message);
      } catch (error) {
        handled.delete(source.id);
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
    const [tags, room] = await Promise.all([ollamaHealth(), fetchRoom()]);
    const installed = (tags.models || []).map(model => model.name);
    console.log(JSON.stringify({ ok: installed.some(name => name.startsWith(settings.model.split(':')[0])), model: settings.model, installed, recentChatRows: room.length }, null, 2));
    return;
  }
  log('Starting BCD House Guide', `model=${settings.model} context=${settings.contextMinutes}m poll=${settings.pollMs}ms${settings.dryRun ? ' DRY-RUN' : ''}`);
  await cycle();
  if (process.argv.includes('--once')) return;
  setInterval(cycle, Math.max(2000, settings.pollMs));
}

process.on('unhandledRejection', error => log('Unhandled error:', error?.stack || error));
process.on('SIGINT', () => process.exit(0));
await main();
