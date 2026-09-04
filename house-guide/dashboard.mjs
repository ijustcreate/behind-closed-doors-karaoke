import http from 'node:http';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recentActivity, recentInteractions } from './activity.mjs';
import { loadEnv } from './lib.mjs';
import { loadRuntimeConfig, saveRuntimeConfig } from './runtime-config.mjs';

loadEnv(fileURLToPath(new URL('.env', import.meta.url)));
const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const port = Number(process.env.BCD_DASHBOARD_PORT || 3434);
const here = path.dirname(fileURLToPath(import.meta.url));
const knowledgeDirectory = path.join(here, 'knowledge');
const teachingFile = path.join(knowledgeDirectory, 'owner-notes.json');

function loadKnowledge() {
  return Object.fromEntries(fs.readdirSync(knowledgeDirectory).filter(file => file.endsWith('.json')).map(file => [file, JSON.parse(fs.readFileSync(path.join(knowledgeDirectory, file), 'utf8'))]));
}

function loadTeachingNotes() {
  if (!fs.existsSync(teachingFile)) return { bcdHistory: [], stockton: [], stocktonTheater: [], stocktonSports: [], miracleMile: [], communityEvents: [] };
  return JSON.parse(fs.readFileSync(teachingFile, 'utf8'));
}

function saveTeachingNote({ category, fact, source }) {
  const allowed = new Set(['bcdHistory', 'stockton', 'stocktonTheater', 'stocktonSports', 'miracleMile', 'communityEvents']);
  if (!allowed.has(category)) throw new Error('Choose a valid knowledge category.');
  const cleanFact = String(fact || '').replace(/\s+/g, ' ').trim();
  const cleanSource = String(source || '').replace(/\s+/g, ' ').trim();
  if (cleanFact.length < 4 || cleanFact.length > 1000) throw new Error('Teaching note must be between 4 and 1,000 characters.');
  if (cleanSource.length > 500) throw new Error('Source note is too long.');
  const notes = loadTeachingNotes();
  if (!Array.isArray(notes[category])) notes[category] = [];
  notes[category].push({ fact: cleanFact, source: cleanSource || undefined, addedAt: new Date().toISOString() });
  fs.writeFileSync(teachingFile, `${JSON.stringify(notes, null, 2)}\n`, 'utf8');
  return notes;
}

async function roomContext() {
  const since = new Date(Date.now() - Number(process.env.ROOM_CONTEXT_MINUTES || 80) * 60_000).toISOString();
  const query = new URLSearchParams({ created_at: `gte.${since}`, select: 'id,singer_name,message,image_urls,created_at', order: 'created_at.asc', limit: '80' });
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/karaoke_chat_messages?${query}`, {
      headers: { apikey: process.env.SUPABASE_KEY, Authorization: `Bearer ${process.env.SUPABASE_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Chat context unavailable (${response.status})`);
    const rows = await response.json();
    return { rows: rows.map(row => ({ singer: row.singer_name, message: row.message, createdAt: row.created_at, imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [] })), error: null };
  } catch (error) {
    return { rows: [], error: String(error.message || error) };
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 4096) reject(new Error('Request is too large.')); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid request.')); } });
    req.on('error', reject);
  });
}

async function ollamaStatus() {
  const started = Date.now();
  try {
    const [tagsResponse, psResponse] = await Promise.all([
      fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) }),
      fetch(`${ollamaUrl}/api/ps`, { signal: AbortSignal.timeout(3000) }),
    ]);
    if (!tagsResponse.ok) throw new Error(`Ollama returned ${tagsResponse.status}`);
    const tags = await tagsResponse.json();
    const loaded = psResponse.ok ? await psResponse.json() : { models: [] };
    return {
      reachable: true,
      latencyMs: Date.now() - started,
      available: (tags.models || []).map(model => model.name),
      loaded: (loaded.models || []).map(model => model.name),
    };
  } catch (error) {
    return { reachable: false, latencyMs: Date.now() - started, available: [], loaded: [], error: String(error.message || error) };
  }
}

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BCD House Guide Console</title><style>
*{box-sizing:border-box}body{margin:0;background:#11100f;color:#f4ead6;font:15px system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:1120px;margin:auto;padding:28px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px}.top h1{margin:0;font-size:27px}.muted{color:#c8bda7}.badge{display:inline-block;padding:7px 11px;border-radius:99px;font-weight:700}.up,.ok{background:#173d2e;color:#b9f0ce}.down,.error{background:#512124;color:#ffc4c4}.card{background:#1d1a17;border:1px solid #3b342c;border-radius:14px;padding:18px;margin-top:18px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.label{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#c8bda7}.value{font-size:20px;margin-top:5px;word-break:break-word}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #3b342c;vertical-align:top}th{font-size:12px;color:#c8bda7;text-transform:uppercase}td{font-size:14px}.model,.fact{display:inline-block;margin:4px 5px 0 0;padding:5px 8px;border-radius:6px;background:#302a24}.fact{display:block;white-space:pre-wrap;line-height:1.4}button{color:#18130e;background:#e7b85a;border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}input,select,textarea{width:100%;margin-top:5px;padding:9px;border-radius:7px;border:1px solid #645747;background:#151310;color:#f4ead6;font:inherit}textarea{min-height:92px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.wide{grid-column:1/-1}.notice{margin-top:10px}.tabs{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.tabs button{background:#302a24;color:#f4ead6}.tabs button.active{background:#e7b85a;color:#18130e}.panel{display:none}.panel.active{display:block}@media(max-width:680px){.grid,.form-grid{grid-template-columns:1fr}.wrap{padding:18px}.top{align-items:flex-start;flex-direction:column}table{font-size:12px}}
</style></head><body><main class="wrap"><div class="top"><div><h1>BCD House Guide Console</h1><div class="muted">Local-only monitor and knowledge editor · updates every 5 seconds</div></div><button onclick="refresh()">Refresh now</button></div><section class="card"><div class="grid"><div><div class="label">Ollama</div><div class="value" id="ollama">Checking…</div></div><div><div class="label">Response time</div><div class="value" id="latency">—</div></div><div><div class="label">Recent bot outcome</div><div class="value" id="outcome">No activity yet</div></div></div><div class="label" style="margin-top:18px">Available models</div><div id="available" class="muted">—</div><div class="label" style="margin-top:14px">Loaded in memory</div><div id="loaded" class="muted">—</div></section><div class="tabs"><button class="active" onclick="show('activity',this)">Activity</button><button onclick="show('context',this)">Live chat context</button><button onclick="show('knowledge',this)">What BCD knows</button><button onclick="show('teach',this)">Teach the bot</button></div><section class="card panel active" id="activity"><strong>Recent activity</strong><div class="muted">Requests, image checks, outcomes, timing, and errors. Private chat content is never logged here.</div><div style="overflow:auto"><table><thead><tr><th>Time</th><th>Activity</th><th>Model</th><th>Outcome</th><th>Time</th><th>Details</th></tr></thead><tbody id="events"><tr><td colspan="6" class="muted">Loading…</td></tr></tbody></table></div></section><section class="card panel" id="context"><strong>Live chat context the bot can use</strong><div class="muted">The bot reads this rolling 80-minute room window to answer a current question. It does not turn this chat into permanent knowledge.</div><div id="contextRows" style="margin-top:12px">Loading…</div></section><section class="card panel" id="knowledge"><strong>Approved House Book</strong><div class="muted">These local JSON facts and songbook entries are the permanent information the bot can use. Everything here may be shared in guest-facing answers.</div><div id="knowledgeRows" style="margin-top:12px">Loading…</div></section><section class="card panel" id="teach"><strong>Teach the House Guide</strong><div class="muted">Add a verified, guest-safe fact. The bot reloads it automatically within about 10 seconds. For events, include the date, venue, and source in the fact itself; replace or remove stale entries in the local file when plans change.</div><form id="teachForm" class="form-grid" style="margin-top:12px"><label>Topic<select name="category"><option value="bcdHistory">BCD / restaurant history</option><option value="stockton">Stockton background</option><option value="stocktonTheater">Stockton theater & arts</option><option value="stocktonSports">Stockton sports</option><option value="miracleMile">Miracle Mile businesses</option><option value="communityEvents">Community events</option></select></label><label>Source or verification note (recommended)<input name="source" maxlength="500" placeholder="Example: Stockton Civic Theatre calendar, verified Aug. 2026"></label><label class="wide">Fact to teach<textarea name="fact" maxlength="1000" required placeholder="Example: On Sept. 12, 2026, … at …"></textarea></label><div class="wide"><button type="submit">Save teaching note</button><div id="teachResult" class="notice muted"></div></div></form></section></main><script>
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const models=(items,empty)=>items?.length?items.map(x=>'<span class="model">'+esc(x)+'</span>').join(''): '<span class="muted">'+empty+'</span>';
function show(id,button){document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x.id===id));document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));button.classList.add('active')}
window.show=show;
function facts(value,prefix=''){if(Array.isArray(value))return value.flatMap(x=>facts(x,prefix));if(value&&typeof value==='object')return Object.entries(value).flatMap(([k,x])=>facts(x,prefix?prefix+' › '+k:k));return value==null||value===''?[]:[prefix+': '+value]}
async function refresh(){try{const r=await fetch('/api/status',{cache:'no-store'});const d=await r.json();const o=d.ollama;document.querySelector('#ollama').innerHTML='<span class="badge '+(o.reachable?'up':'down')+'">'+(o.reachable?'Reachable':'Unavailable')+'</span>';document.querySelector('#latency').textContent=o.latencyMs+' ms';document.querySelector('#available').innerHTML=models(o.available,'No models reported');document.querySelector('#loaded').innerHTML=models(o.loaded,'No models currently loaded');const latest=d.activity.find(x=>x.type==='bot_reply');document.querySelector('#outcome').innerHTML=latest?'<span class="badge '+(latest.outcome==='success'?'ok':'error')+'">'+esc(latest.outcome)+'</span>':'No activity yet';document.querySelector('#events').innerHTML=d.activity.length?d.activity.map(x=>'<tr><td>'+esc(new Date(x.timestamp).toLocaleString())+'</td><td>'+esc(x.type||'event')+'</td><td>'+esc(x.model||'—')+'</td><td><span class="badge '+(x.outcome==='success'?'ok':x.outcome==='error'?'error':'')+'">'+esc(x.outcome||'—')+'</span></td><td>'+esc(x.latencyMs==null?'—':x.latencyMs+' ms')+'</td><td>'+esc(x.error||x.note||'—')+'</td></tr>').join(''):'<tr><td colspan="6" class="muted">No recorded activity yet.</td></tr>';document.querySelector('#contextRows').innerHTML=d.context.error?'<span class="badge error">'+esc(d.context.error)+'</span>':d.context.rows.length?d.context.rows.map(x=>'<div class="fact"><strong>'+esc(new Date(x.createdAt).toLocaleTimeString())+' · '+esc(x.singer)+'</strong>'+ (x.hasImage?' · 📷':'')+'<br>'+esc(x.message)+'</div>').join(''):'<span class="muted">No messages in the current 80-minute window.</span>';const entries=Object.entries(d.knowledge).flatMap(([file,value])=>facts(value,file.replace('.json','')));document.querySelector('#knowledgeRows').innerHTML=entries.length?entries.map(x=>'<div class="fact">'+esc(x)+'</div>').join(''):'<span class="muted">No approved facts found.</span>'}catch(e){document.querySelector('#ollama').textContent='Dashboard error: '+e.message}}
document.querySelector('#teachForm').addEventListener('submit',async e=>{e.preventDefault();const result=document.querySelector('#teachResult');result.textContent='Saving…';try{const form=new FormData(e.target);const r=await fetch('/api/teach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form))});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to save');result.textContent='Saved. The bot will use this as public House Book context within about 10 seconds.';e.target.reset();refresh()}catch(error){result.textContent=error.message}});
document.querySelector('.tabs').insertAdjacentHTML('beforeend','<button data-dashboard-tab="interactions">Interactions &amp; traces</button><button data-dashboard-tab="filters">Filters &amp; settings</button>');
document.querySelectorAll('[data-dashboard-tab]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.dashboardTab,button)));
document.querySelector('.wrap').insertAdjacentHTML('beforeend','<section class="card panel" id="interactions"><strong>Bot interactions and decision traces</strong><div class="muted">Each trace explains the trigger, approved facts, song matches, room context, model calls, output, and timing. This is an explanation of the response path—not hidden model reasoning. Images and private image captions are shown only in this local owner console.</div><div id="interactionRows" style="margin-top:12px">Loading…</div></section><section class="card panel" id="filters"><strong>Bot filters &amp; settings</strong><div class="muted">Changes are saved locally and the bot applies them within about 10 seconds. Turning off “Require a BCD tag” makes the bot answer any room message, so leave it enabled unless you truly want an active host bot.</div><form id="configForm" class="form-grid" style="margin-top:12px"><label>Room context minutes<input name="contextMinutes" type="number" min="15" max="240"></label><label>Ignored words or phrases<textarea name="ignoredPhrases" placeholder="One phrase per line"></textarea></label><label><input name="requireExplicitSummon" type="checkbox" checked> Require @BCD / BCD tag before replying</label><label><input name="enableDescription" type="checkbox" checked> Create private image descriptions</label><label><input name="enableSafetyCheck" type="checkbox" checked> Run vision graphic-content safety check</label><div class="wide"><button type="submit">Save filters &amp; settings</button><div id="configResult" class="notice muted"></div></div></form></section>');
function imageMarkup(url){return url?'<img src="'+esc(url)+'" alt="Chat image" style="display:block;max-width:320px;max-height:260px;margin-top:8px;border-radius:8px">':''}
function interactionMarkup(item){const input=item.input||{};const output=item.output||'';const trace=item.trace||{};const imageUrls=input.imageUrls||[];const imageUrl=input.imageUrl||imageUrls[0];const traceRows=[trace.trigger&&'Trigger: '+trace.trigger,trace.route&&'Path: '+trace.route,trace.roomMessagesUsed!=null&&'Room messages used: '+trace.roomMessagesUsed,trace.roomImagesWithPrivateContext!=null&&'Images with private context: '+trace.roomImagesWithPrivateContext,trace.factsUsed?.length&&'Approved facts: '+trace.factsUsed.join(' | '),trace.songMatches?.length&&'Song matches: '+trace.songMatches.map(x=>x.title+' — '+x.artist+' (TJ '+x.code+')').join(' | '),trace.modelCalls?.length&&'Model calls: '+trace.modelCalls.map(x=>x.purpose+' '+x.model+' '+x.latencyMs+' ms ('+x.outcome+')').join(' | ')].filter(Boolean);return '<details class="fact"><summary><strong>'+esc(new Date(item.timestamp).toLocaleString())+' · '+esc(item.type)+' · '+esc(item.outcome)+' · '+esc(item.latencyMs==null?'—':item.latencyMs+' ms')+'</strong></summary><div style="margin-top:8px"><strong>Guest input:</strong> '+esc(input.singer||'—')+' — '+esc(input.message||input.messageId||'—')+imageMarkup(imageUrl)+'<br><br><strong>Bot / vision output:</strong><br>'+esc(typeof output==='string'?output:JSON.stringify(output,null,2))+'<br><br><strong>Why it responded this way:</strong><br>'+esc(traceRows.join('\\n')||item.error||'No additional trace available.')+'</div></details>'}
async function refreshAdvanced(){try{const r=await fetch('/api/status',{cache:'no-store'});const d=await r.json();document.querySelector('#interactionRows').innerHTML=d.interactions?.length?d.interactions.map(interactionMarkup).join(''):'<span class="muted">New interactions will appear here after the bot handles a message or image.</span>';const context=document.querySelector('#contextRows');if(!d.context.error&&d.context.rows.length)context.innerHTML=d.context.rows.map(x=>'<div class="fact"><strong>'+esc(new Date(x.createdAt).toLocaleTimeString())+' · '+esc(x.singer)+'</strong><br>'+esc(x.message)+(x.imageUrls||[]).map(imageMarkup).join('')+'</div>').join('');const form=document.querySelector('#configForm');if(!form.dataset.touched){form.contextMinutes.value=d.config.bot.contextMinutes;form.requireExplicitSummon.checked=d.config.bot.requireExplicitSummon;form.ignoredPhrases.value=d.config.bot.ignoredPhrases.join('\\n');form.enableDescription.checked=d.config.vision.enableDescription;form.enableSafetyCheck.checked=d.config.vision.enableSafetyCheck}}catch{}}
const baseRefresh=refresh;refresh=async()=>{await baseRefresh();await refreshAdvanced()};document.querySelector('#configForm').addEventListener('input',e=>e.currentTarget.dataset.touched='true');document.querySelector('#configForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const result=document.querySelector('#configResult');result.textContent='Saving…';try{const body={contextMinutes:f.contextMinutes.value,requireExplicitSummon:f.requireExplicitSummon.checked,ignoredPhrases:f.ignoredPhrases.value,enableDescription:f.enableDescription.checked,enableSafetyCheck:f.enableSafetyCheck.checked};const r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to save');f.dataset.touched='';result.textContent='Saved. The bot will apply these filters within about 10 seconds.';refresh()}catch(error){result.textContent=error.message}});
refresh();setInterval(refresh,5000);
</script></body></html>`;

http.createServer(async (req, res) => {
  if (req.url === '/api/status') {
    const [ollama, context] = await Promise.all([ollamaStatus(), roomContext()]);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ollama, activity: recentActivity(120), interactions: recentInteractions(80), context, knowledge: loadKnowledge(), config: loadRuntimeConfig(here) }));
    return;
  }
  if (req.url === '/api/teach' && req.method === 'POST') {
    try {
      saveTeachingNote(await readRequestBody(req));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(error.message || error) }));
    }
    return;
  }
  if (req.url === '/api/config' && req.method === 'POST') {
    try {
      const body = await readRequestBody(req);
      const config = saveRuntimeConfig(here, {
        bot: { contextMinutes: body.contextMinutes, requireExplicitSummon: body.requireExplicitSummon, ignoredPhrases: String(body.ignoredPhrases || '').split(/\r?\n|,/).map(item => item.trim()).filter(Boolean) },
        vision: { enableDescription: body.enableDescription, enableSafetyCheck: body.enableSafetyCheck },
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, config }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(error.message || error) }));
    }
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(page);
}).listen(port, '127.0.0.1', () => console.log(`BCD bot dashboard: http://127.0.0.1:${port}`));
