import { COMBAT } from '../../config/gameplay';
import type { Fighter, HatId, Vec2 } from '../../types/game';

interface FighterOptions {
  id: string;
  name: string;
  spawn: Vec2;
  palette: readonly [string, string];
  songs: string[];
  isPlayer?: boolean;
  facing?: -1 | 1;
  hat?: HatId;
}

export function createFighter(options: FighterOptions): Fighter {
  return {
    id: options.id, name: options.name, x: options.spawn.x, y: options.spawn.y,
    previousX: options.spawn.x, previousY: options.spawn.y, vx: 0, vy: 0, w: 22, h: 31,
    facing: options.facing ?? 1, color: options.palette[0], accent: options.palette[1], hat:options.hat ?? 'crown', isPlayer: !!options.isPlayer,
    alive: true, animation: 'respawn', animationTime: 0, grounded: false, coyoteTime: 0, jumpBuffer: 0,
    wallSide: 0, dashTime: 0, dashCooldown: 0, attackTime: 0, invulnerableTime: COMBAT.spawnProtection,
    respawnTime: 0, landTime: 0, ammo: COMBAT.maxAmmo, maxAmmo: COMBAT.maxAmmo, kills: 0, deaths: 0,
    songs: options.songs, songIndex: 0, decisionTime: Math.random() * .2, moveIntent: 0,
    jumpIntent: false, shootIntent: false, dodgeIntent: false
  };
}
