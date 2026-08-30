import type { Platform, Vec2 } from '../types/game';

export const VIEWPORT = { width: 960, height: 540 } as const;
export const FIXED_STEP = 1 / 60;
export const PHYSICS = {
  gravity: 1420,
  runSpeed: 230,
  groundAcceleration: 1850,
  airAcceleration: 980,
  jumpVelocity: -455,
  wallJumpVelocityX: 310,
  wallSlideSpeed: 105,
  dashSpeed: 465,
  dashDuration: .24,
  dashCooldown: .72,
  coyoteTime: .095,
  jumpBuffer: .11
} as const;

export const COMBAT = {
  arrowSpeed: 520,
  arrowGravity: 95,
  attackCooldown: .25,
  respawnDelay: 1.35,
  spawnProtection: 1,
  maxAmmo: 2,
  arrowLifetime: 12
} as const;

export const FALLBACK_SONGS = ['Neon Moon', 'Dancing Queen', 'Mr. Brightside', 'Tennessee Whiskey', 'Sweet Caroline', 'Dreams', 'No Scrubs'];
export const BOT_NAMES = ['Velvet', 'Echo', 'Disco', 'Jukebox', 'Reverb', 'Vinyl', 'Tempo'];
export const PALETTES: ReadonlyArray<readonly [string, string]> = [
  ['#ffd46f', '#8b4f7d'], ['#73ddf5', '#3e579d'], ['#ff7d96', '#873a70'],
  ['#a6ef85', '#477d68'], ['#d99aff', '#704f9e'], ['#ffad65', '#a84e48'], ['#f6ef8b', '#7168a0']
];

export const SPAWNS: ReadonlyArray<Vec2> = [
  { x: 88, y: 392 }, { x: 245, y: 222 }, { x: 438, y: 402 },
  { x: 600, y: 172 }, { x: 735, y: 332 }, { x: 868, y: 402 }
];

export const PLATFORMS: ReadonlyArray<Platform> = [
  { x: 0, y: 492, w: 960, h: 48 },
  { x: 48, y: 430, w: 190, h: 16 }, { x: 316, y: 442, w: 198, h: 16 }, { x: 694, y: 430, w: 218, h: 16 },
  { x: 154, y: 328, w: 198, h: 14 }, { x: 447, y: 340, w: 188, h: 14 }, { x: 703, y: 282, w: 155, h: 14 },
  { x: 43, y: 220, w: 146, h: 14 }, { x: 337, y: 226, w: 178, h: 14 }, { x: 563, y: 172, w: 166, h: 14 },
  { x: 228, y: 112, w: 132, h: 12 }, { x: 758, y: 100, w: 142, h: 12 }
];

