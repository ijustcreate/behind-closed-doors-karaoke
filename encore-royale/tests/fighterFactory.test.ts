import { describe, expect, it } from 'vitest';
import { COMBAT } from '../src/config/gameplay';
import { createFighter } from '../src/game/entities/createFighter';

describe('createFighter', () => {
  it('creates a protected, fully stocked combatant at the requested spawn', () => {
    const fighter = createFighter({
      id: 'test-player',
      name: 'Cole',
      spawn: { x: 120, y: 300 },
      palette: ['#ffffff', '#000000'],
      songs: ['Dreams'],
      isPlayer: true
    });

    expect(fighter.x).toBe(120);
    expect(fighter.y).toBe(300);
    expect(fighter.ammo).toBe(COMBAT.maxAmmo);
    expect(fighter.invulnerableTime).toBe(COMBAT.spawnProtection);
    expect(fighter.animation).toBe('respawn');
    expect(fighter.songs).toEqual(['Dreams']);
  });
});

