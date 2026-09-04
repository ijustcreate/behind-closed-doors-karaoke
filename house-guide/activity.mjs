import fs from 'node:fs';
import path from 'node:path';

const maxMessageLength = 360;

export function activityLogPath() {
  return process.env.BCD_ACTIVITY_LOG || path.join(process.cwd(), 'logs', 'bot-activity.jsonl');
}

// This log deliberately excludes guest messages, model replies, image URLs, and credentials.
export function recordActivity(event) {
  try {
    const file = activityLogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const safeEvent = {
      timestamp: new Date().toISOString(),
      ...event,
      error: event?.error ? String(event.error).replace(/\s+/g, ' ').slice(0, maxMessageLength) : undefined,
    };
    fs.appendFileSync(file, `${JSON.stringify(safeEvent)}\n`, 'utf8');
  } catch {
    // Monitoring must never interrupt a guest-facing bot reply.
  }
}

export function recentActivity(limit = 80) {
  try {
    const file = activityLogPath();
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).slice(-Math.max(1, limit)).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean).reverse();
  } catch {
    return [];
  }
}

export function recordInteraction(interaction) {
  try {
    const file = path.join(path.dirname(activityLogPath()), 'bot-interactions.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify({ timestamp: new Date().toISOString(), ...interaction })}\n`, 'utf8');
  } catch {
    // An owner-only inspection trail must never interrupt the bot.
  }
}

export function recentInteractions(limit = 60) {
  try {
    const file = path.join(path.dirname(activityLogPath()), 'bot-interactions.jsonl');
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).slice(-Math.max(1, limit)).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean).reverse();
  } catch {
    return [];
  }
}
