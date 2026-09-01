import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, '.env');
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const match = existing.match(/^VISION_WORKER_SECRET=(.+)$/m);
const secret = match?.[1]?.trim() || crypto.randomBytes(32).toString('base64url');
let next = existing;
if (!match) next = `${existing.trimEnd()}\nVISION_WORKER_SECRET=${secret}\n`;
const defaults = {
  VISION_MODEL: 'gemma3:4b',
  VISION_KEEP_ALIVE: '0',
  VISION_PYTHON: path.join(here, '.venv-vision', 'Scripts', 'python.exe'),
};
for (const [key, value] of Object.entries(defaults)) {
  if (!new RegExp(`^${key}=`, 'm').test(next)) next += `${key}=${value}\n`;
}
fs.writeFileSync(envPath, next, 'utf8');
const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
console.log(JSON.stringify({ configured: true, secretHash }));
