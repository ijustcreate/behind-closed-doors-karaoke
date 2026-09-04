import fs from 'node:fs';
import path from 'node:path';

const DEFAULTS = Object.freeze({
  bot: { contextMinutes: 80, requireExplicitSummon: true, ignoredPhrases: [] },
  vision: { enableDescription: true, enableSafetyCheck: true },
});

export function runtimeConfigPath(baseDirectory) {
  return path.join(baseDirectory, 'runtime-config.json');
}

function normalize(value) {
  const candidate = value && typeof value === 'object' ? value : {};
  const bot = candidate.bot && typeof candidate.bot === 'object' ? candidate.bot : {};
  const vision = candidate.vision && typeof candidate.vision === 'object' ? candidate.vision : {};
  const minutes = Number(bot.contextMinutes);
  return {
    bot: {
      contextMinutes: Number.isFinite(minutes) ? Math.max(15, Math.min(240, Math.round(minutes))) : DEFAULTS.bot.contextMinutes,
      requireExplicitSummon: bot.requireExplicitSummon !== false,
      ignoredPhrases: Array.isArray(bot.ignoredPhrases) ? bot.ignoredPhrases.map(item => String(item).trim()).filter(Boolean).slice(0, 30) : [],
    },
    vision: {
      enableDescription: vision.enableDescription !== false,
      enableSafetyCheck: vision.enableSafetyCheck !== false,
    },
  };
}

export function loadRuntimeConfig(baseDirectory) {
  try {
    const file = runtimeConfigPath(baseDirectory);
    return fs.existsSync(file) ? normalize(JSON.parse(fs.readFileSync(file, 'utf8'))) : structuredClone(DEFAULTS);
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveRuntimeConfig(baseDirectory, settings) {
  const config = normalize(settings);
  fs.writeFileSync(runtimeConfigPath(baseDirectory), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return config;
}
