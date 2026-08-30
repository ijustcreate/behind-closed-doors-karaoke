import { BOT_NAMES, COMBAT, DEFAULT_BOT_COUNT, FALLBACK_SONGS, FIXED_STEP, PALETTES, PHYSICS, PLATFORMS, SPAWNS, VIEWPORT } from '../config/gameplay';
import { FixedStepLoop } from '../engine/FixedStepLoop';
import { haptic } from '../engine/Haptics';
import { InputManager } from '../engine/InputManager';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import type { AnimationState, FeedItem, Fighter, GameMode, GameSession, GameSnapshot, LobbyProfile, NoteArrow, Particle, Vec2 } from '../types/game';
import { createFighter } from './entities/createFighter';
import { updateBotIntent } from './systems/botSystem';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const approach = (value: number, target: number, amount: number): number => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);

export class EncoreRoyale {
  private mode: GameMode = 'booting';
  private time = 0;
  private player!: Fighter;
  private fighters: Fighter[] = [];
  private arrows: NoteArrow[] = [];
  private particles: Particle[] = [];
  private feed: FeedItem[] = [];
  private shake = 0;
  private flash = 0;
  private lobbyDepth = 0;
  private spawnIndex = 0;
  private modeBeforePause: GameMode = 'lobby';
  private arrowId = 0;
  private readonly renderer: CanvasRenderer;
  private readonly loop: FixedStepLoop;

  constructor(
    canvas: HTMLCanvasElement,
    private session: GameSession,
    private readonly input: InputManager,
    private readonly onJoined: () => void = () => undefined
  ) {
    this.renderer = new CanvasRenderer(canvas);
    this.loop = new FixedStepLoop(FIXED_STEP, this.update, this.render);
    this.reset();
  }

  start(): void {
    this.mode = 'lobby';
    this.input.connect();
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
    this.input.disconnect();
  }

  setSession(session: GameSession): void {
    this.session = session;
    this.player.name = session.playerName;
    this.player.songs = session.sungSongs.length ? [...session.sungSongs] : FALLBACK_SONGS.slice();
  }

  togglePause(): void {
    if (this.mode === 'paused') this.mode = this.modeBeforePause;
    else { this.modeBeforePause = this.mode; this.mode = 'paused'; }
    this.render();
  }

  setPaused(paused: boolean): void {
    if (paused && this.mode !== 'paused') { this.modeBeforePause = this.mode; this.mode = 'paused'; }
    else if (!paused && this.mode === 'paused') this.mode = this.modeBeforePause;
    this.render();
  }

  configurePlayer(profile: LobbyProfile): void {
    this.player.name = profile.name;
    this.player.color = profile.color;
    this.player.accent = profile.accent;
    this.player.hat = profile.hat;
  }

  beginJoin(): void {
    if (this.mode !== 'lobby') return;
    this.mode = 'spawn-select';
    this.lobbyDepth = 0;
    this.spawnIndex = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this.setAnimation(this.player, 'idle');
  }

  advanceTime(milliseconds: number): void { this.loop.advance(milliseconds); }

  toText(): string {
    return JSON.stringify({
      mode: this.mode,
      coordinateSystem: 'Canvas 960x540; origin top-left; x increases right; y increases down.',
      roomId: this.session.roomId,
      installedController: this.session.installed,
      lobbyDepth: Number(this.lobbyDepth.toFixed(2)),
      selectedSpawn: this.spawnIndex,
      player: this.summarizeFighter(this.player),
      opponents: this.fighters.filter(fighter => !fighter.isPlayer).map(fighter => this.summarizeFighter(fighter)),
      arrows: this.arrows.map(arrow => ({ x:Math.round(arrow.x), y:Math.round(arrow.y), state:arrow.state, song:arrow.song, owner:arrow.ownerId })),
      recentFeed: this.feed.slice(0, 3).map(item => item.text)
    });
  }

  private summarizeFighter(fighter: Fighter) {
    return {
      id:fighter.id, name:fighter.name, x:Math.round(fighter.x), y:Math.round(fighter.y),
      vx:Math.round(fighter.vx), vy:Math.round(fighter.vy), animation:fighter.animation,
      alive:fighter.alive, ammo:fighter.ammo, kills:fighter.kills, deaths:fighter.deaths,
      grounded:fighter.grounded, wallSide:fighter.wallSide, dashReady:fighter.dashCooldown <= 0
    };
  }

  private reset(): void {
    this.time = 0;
    this.arrows = [];
    this.particles = [];
    this.feed = [];
    this.player = createFighter({
      id: this.session.playerId,
      name: this.session.playerName,
      spawn: SPAWNS[0]!,
      palette: PALETTES[0]!,
      songs: this.session.sungSongs.length ? [...this.session.sungSongs] : FALLBACK_SONGS.slice(),
      isPlayer: true
    });
    this.player.x = 469;
    this.player.y = 437;
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
    this.player.animation = 'idle';
    this.player.invulnerableTime = 0;
    this.fighters = [];
    for (let index = 0; index < DEFAULT_BOT_COUNT; index++) {
      this.fighters.push(createFighter({
        id: `bot-${index}`,
        name: BOT_NAMES[index]!,
        spawn: SPAWNS[index + 1]!,
        palette: PALETTES[index + 1]!,
        songs: [FALLBACK_SONGS[index % FALLBACK_SONGS.length]!, FALLBACK_SONGS[(index + 2) % FALLBACK_SONGS.length]!],
        facing: index % 2 ? -1 : 1
      }));
    }
    this.addFeed('The backstage battle never ends', '#f0d07a');
  }

  private readonly update = (dt: number): void => {
    if (this.mode === 'paused' || this.mode === 'booting') return;
    this.time += dt;
    for (const fighter of this.fighters) this.updateFighter(fighter, dt);
    if (this.mode === 'lobby') this.updateLobbyPlayer(dt);
    if (this.mode === 'spawn-select') this.updateSpawnSelection(dt);
    this.updateArrows(dt);
    this.updateParticles(dt);
    this.input.endFrame();
  };

  private readonly render = (): void => { this.renderer.render(this.snapshot()); };

  private snapshot(): GameSnapshot {
    return {
      mode:this.mode, time:this.time, player:this.player, fighters:this.fighters,
      arrows:this.arrows, particles:this.particles, feed:this.feed, shake:this.shake, flash:this.flash,
      lobbyDepth:this.lobbyDepth, spawnIndex:this.spawnIndex
    };
  }

  private updateLobbyPlayer(dt: number): void {
    const floor = 468;
    this.player.animationTime += dt;
    const movement = ((this.input.isDown('right') ? 1 : 0) - (this.input.isDown('left') ? 1 : 0)) as -1 | 0 | 1;
    if (movement) this.player.facing = movement;
    this.player.vx = approach(this.player.vx, movement * 195, (movement ? 1250 : 1800) * dt);
    if (this.input.consume('jump') && this.player.grounded) {
      this.player.vy = -405;
      this.player.grounded = false;
      this.burst(this.player.x + this.player.w / 2, floor, this.player.color, 8, 72, true);
      haptic(10);
    }
    this.player.vy += PHYSICS.gravity * dt;
    this.player.x = clamp(this.player.x + this.player.vx * dt, 54, VIEWPORT.width - 76);
    this.player.y += this.player.vy * dt;
    if (this.player.y + this.player.h >= floor) {
      const landed = !this.player.grounded && this.player.vy > 80;
      this.player.y = floor - this.player.h;
      this.player.vy = 0;
      this.player.grounded = true;
      if (landed) this.player.landTime = .1;
    }
    this.player.landTime = Math.max(0, this.player.landTime - dt);
    if (this.player.landTime > 0) this.setAnimation(this.player, 'land');
    else if (!this.player.grounded && this.player.vy < 0) this.setAnimation(this.player, 'jump');
    else if (!this.player.grounded) this.setAnimation(this.player, 'fall');
    else if (Math.abs(this.player.vx) > 20) this.setAnimation(this.player, 'run');
    else this.setAnimation(this.player, 'idle');
    this.input.consume('shoot');
    this.input.consume('dodge');
  }

  private updateSpawnSelection(dt: number): void {
    this.lobbyDepth = Math.min(1, this.lobbyDepth + dt * 1.25);
    if (this.input.consume('left')) this.spawnIndex = (this.spawnIndex + SPAWNS.length - 1) % SPAWNS.length;
    if (this.input.consume('right')) this.spawnIndex = (this.spawnIndex + 1) % SPAWNS.length;
    const spawn = SPAWNS[this.spawnIndex]!;
    this.player.x = approach(this.player.x, spawn.x, 780 * dt);
    this.player.y = approach(this.player.y, spawn.y, 520 * dt);
    this.player.animationTime += dt;
    this.setAnimation(this.player, 'respawn');
    const confirm = this.input.consume('jump') || this.input.consume('shoot');
    if (confirm && this.lobbyDepth > .56) this.joinAtSelectedSpawn();
    this.input.consume('dodge');
  }

  private joinAtSelectedSpawn(): void {
    const spawn = SPAWNS[this.spawnIndex]!;
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    this.player.previousX = spawn.x;
    this.player.previousY = spawn.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.grounded = false;
    this.player.invulnerableTime = COMBAT.spawnProtection;
    this.player.animation = 'respawn';
    this.player.animationTime = 0;
    this.fighters.push(this.player);
    this.mode = 'playing';
    this.burst(spawn.x + this.player.w / 2, spawn.y + this.player.h, this.player.color, 28, 170, true);
    this.addFeed(`${this.player.name} stepped through the curtain`, this.player.color);
    this.onJoined();
  }

  private playerIntent(fighter: Fighter): void {
    fighter.moveIntent = (this.input.isDown('right') ? 1 : 0) - (this.input.isDown('left') ? 1 : 0) as -1 | 0 | 1;
    fighter.jumpIntent = this.input.consume('jump');
    fighter.shootIntent = this.input.consume('shoot');
    fighter.dodgeIntent = this.input.consume('dodge');
  }

  private clearIntent(fighter: Fighter): void {
    fighter.jumpIntent = false;
    fighter.shootIntent = false;
    fighter.dodgeIntent = false;
  }

  private updateFighter(fighter: Fighter, dt: number): void {
    fighter.animationTime += dt;
    fighter.invulnerableTime = Math.max(0, fighter.invulnerableTime - dt);
    fighter.attackTime = Math.max(0, fighter.attackTime - dt);
    fighter.dashCooldown = Math.max(0, fighter.dashCooldown - dt);
    fighter.landTime = Math.max(0, fighter.landTime - dt);

    if (!fighter.alive) {
      fighter.respawnTime -= dt;
      fighter.vy += PHYSICS.gravity * .58 * dt;
      fighter.x += fighter.vx * dt;
      fighter.y += fighter.vy * dt;
      fighter.vx *= Math.pow(.04, dt);
      if (fighter.respawnTime <= 0) this.respawn(fighter);
      return;
    }

    this.clearIntent(fighter);
    if (fighter.isPlayer) this.playerIntent(fighter);
    else updateBotIntent(fighter, this.fighters, dt);
    if (fighter.dodgeIntent) this.dash(fighter);
    if (fighter.shootIntent) this.fire(fighter);
    if (fighter.jumpIntent) fighter.jumpBuffer = PHYSICS.jumpBuffer;
    fighter.jumpBuffer = Math.max(0, fighter.jumpBuffer - dt);
    fighter.coyoteTime = fighter.grounded ? PHYSICS.coyoteTime : Math.max(0, fighter.coyoteTime - dt);
    if (fighter.jumpBuffer > 0 && this.jump(fighter)) fighter.jumpBuffer = 0;

    fighter.previousX = fighter.x;
    fighter.previousY = fighter.y;
    if (fighter.dashTime > 0) {
      fighter.dashTime -= dt;
      fighter.vx = fighter.facing * PHYSICS.dashSpeed;
      if (Math.random() < .68) this.particles.push({ x:fighter.x+fighter.w/2, y:fighter.y+fighter.h/2, vx:-fighter.facing*30, vy:0, color:fighter.accent, life:.17, size:7, gravity:0 });
    } else {
      if (fighter.moveIntent) fighter.facing = fighter.moveIntent;
      const acceleration = fighter.grounded ? PHYSICS.groundAcceleration : PHYSICS.airAcceleration;
      fighter.vx = approach(fighter.vx, fighter.moveIntent * PHYSICS.runSpeed, acceleration * dt);
      if (!fighter.moveIntent && fighter.grounded) fighter.vx = approach(fighter.vx, 0, 2300 * dt);
      fighter.vy += PHYSICS.gravity * dt;
    }
    fighter.x += fighter.vx * dt;
    fighter.y += fighter.vy * dt;
    this.collideFighter(fighter);
    this.chooseAnimation(fighter);
  }

  private chooseAnimation(fighter: Fighter): void {
    let next: AnimationState;
    if (fighter.animation === 'respawn' && fighter.animationTime < .48) return;
    if (fighter.attackTime > 0) next = 'shoot';
    else if (fighter.dashTime > 0) next = 'dodge';
    else if (fighter.landTime > 0) next = 'land';
    else if (fighter.wallSide) next = 'wall-slide';
    else if (!fighter.grounded && fighter.vy < 35) next = 'jump';
    else if (!fighter.grounded) next = 'fall';
    else if (Math.abs(fighter.vx) > 35) next = 'run';
    else if (fighter.isPlayer && this.input.isDown('down')) next = 'crouch';
    else next = 'idle';
    this.setAnimation(fighter, next);
  }

  private setAnimation(fighter: Fighter, animation: AnimationState): void {
    if (fighter.animation === animation) return;
    fighter.animation = animation;
    fighter.animationTime = 0;
  }

  private jump(fighter: Fighter): boolean {
    if (fighter.wallSide) {
      fighter.vx = -fighter.wallSide * PHYSICS.wallJumpVelocityX;
      fighter.vy = PHYSICS.jumpVelocity;
      fighter.facing = -fighter.wallSide as -1 | 1;
      fighter.wallSide = 0;
    } else if (fighter.grounded || fighter.coyoteTime > 0) {
      fighter.vy = PHYSICS.jumpVelocity;
      fighter.grounded = false;
      fighter.coyoteTime = 0;
    } else return false;
    this.setAnimation(fighter, 'jump');
    this.burst(fighter.x + fighter.w / 2, fighter.y + fighter.h, fighter.color, 7, 70);
    if (fighter.isPlayer) haptic(10);
    return true;
  }

  private dash(fighter: Fighter): void {
    if (fighter.dashCooldown > 0 || fighter.dashTime > 0) return;
    fighter.dashTime = PHYSICS.dashDuration;
    fighter.dashCooldown = PHYSICS.dashCooldown;
    fighter.invulnerableTime = Math.max(fighter.invulnerableTime, .22);
    fighter.vx = fighter.facing * PHYSICS.dashSpeed;
    fighter.vy *= .25;
    this.setAnimation(fighter, 'dodge');
    this.burst(fighter.x + fighter.w / 2, fighter.y + fighter.h / 2, fighter.accent, 9, 72);
  }

  private fire(fighter: Fighter): void {
    if (fighter.ammo <= 0 || fighter.attackTime > 0 || fighter.dashTime > 0) return;
    fighter.ammo--;
    fighter.attackTime = COMBAT.attackCooldown;
    fighter.songIndex = (fighter.songIndex + 1) % fighter.songs.length;
    const vertical = fighter.isPlayer ? (this.input.isDown('up') ? -1 : this.input.isDown('down') ? 1 : 0) : 0;
    const vx = vertical ? fighter.facing * COMBAT.arrowSpeed * .82 : fighter.facing * COMBAT.arrowSpeed;
    const vy = vertical * COMBAT.arrowSpeed * .58 - (vertical ? 0 : 16);
    this.arrows.push({
      id:++this.arrowId, x:fighter.x+fighter.w/2+fighter.facing*16, y:fighter.y+13,
      previousX:fighter.x, previousY:fighter.y, vx, vy, ownerId:fighter.id,
      song:fighter.songs[fighter.songIndex] ?? FALLBACK_SONGS[0]!, color:fighter.color,
      state:'flying', age:0, labelTime:1.45, pickupDelay:.24, angle:Math.atan2(vy,vx)
    });
    fighter.vx -= fighter.facing * 28;
    this.setAnimation(fighter, 'shoot');
    this.burst(fighter.x + fighter.w / 2 + fighter.facing * 14, fighter.y + 14, fighter.color, 5, 48);
    if (fighter.isPlayer) haptic(8);
  }

  private collideFighter(fighter: Fighter): void {
    const oldBottom = fighter.previousY + fighter.h;
    const newBottom = fighter.y + fighter.h;
    fighter.grounded = false;
    for (const platform of PLATFORMS) {
      const horizontal = fighter.x + fighter.w > platform.x + 2 && fighter.x < platform.x + platform.w - 2;
      if (horizontal && fighter.vy >= 0 && oldBottom <= platform.y + 5 && newBottom >= platform.y) {
        fighter.y = platform.y - fighter.h;
        fighter.vy = 0;
        fighter.grounded = true;
        if (oldBottom < platform.y - 3) fighter.landTime = .1;
        break;
      }
    }
    fighter.wallSide = 0;
    if (fighter.x <= 0) {
      fighter.x = 0;
      if (!fighter.grounded && fighter.vy > 0 && fighter.moveIntent < 0) fighter.wallSide = -1;
      if (fighter.vx < 0) fighter.vx = 0;
    } else if (fighter.x + fighter.w >= VIEWPORT.width) {
      fighter.x = VIEWPORT.width - fighter.w;
      if (!fighter.grounded && fighter.vy > 0 && fighter.moveIntent > 0) fighter.wallSide = 1;
      if (fighter.vx > 0) fighter.vx = 0;
    }
    if (fighter.wallSide) fighter.vy = Math.min(fighter.vy, PHYSICS.wallSlideSpeed);
    if (fighter.y > VIEWPORT.height + 65) this.kill(fighter, null, 'the trapdoor');
  }

  private updateArrows(dt: number): void {
    for (const arrow of this.arrows) {
      arrow.age += dt;
      arrow.labelTime -= dt;
      arrow.pickupDelay -= dt;
      if (arrow.state === 'flying') {
        arrow.previousX = arrow.x;
        arrow.previousY = arrow.y;
        arrow.vy += COMBAT.arrowGravity * dt;
        arrow.x += arrow.vx * dt;
        arrow.y += arrow.vy * dt;
        arrow.angle = Math.atan2(arrow.vy, arrow.vx);
        if (this.pointInsidePlatform(arrow.x, arrow.y) || arrow.x < 0 || arrow.x > VIEWPORT.width || arrow.y < 0 || arrow.y > VIEWPORT.height) {
          this.stickArrow(arrow);
        } else {
          for (const fighter of this.fighters) {
            if (!fighter.alive || fighter.id === arrow.ownerId || fighter.invulnerableTime > 0) continue;
            if (arrow.x >= fighter.x - 3 && arrow.x <= fighter.x + fighter.w + 3 && arrow.y >= fighter.y - 2 && arrow.y <= fighter.y + fighter.h + 2) {
              this.kill(fighter, arrow.ownerId, arrow.song);
              arrow.labelTime = Math.max(arrow.labelTime, 1.05);
              this.stickArrow(arrow);
              break;
            }
          }
        }
      }
      if (arrow.state === 'stuck' && arrow.pickupDelay <= 0) {
        for (const fighter of this.fighters) {
          if (!fighter.alive || fighter.ammo >= fighter.maxAmmo) continue;
          if (Math.hypot(fighter.x + fighter.w / 2 - arrow.x, fighter.y + fighter.h / 2 - arrow.y) < 29) {
            fighter.ammo++;
            arrow.state = 'collected';
            this.burst(arrow.x, arrow.y, fighter.color, 7, 60);
            break;
          }
        }
      }
    }
    this.arrows = this.arrows.filter(arrow => arrow.state !== 'collected' && arrow.age < COMBAT.arrowLifetime);
  }

  private stickArrow(arrow: NoteArrow): void {
    arrow.state = 'stuck';
    arrow.x = clamp(arrow.x, 5, VIEWPORT.width - 5);
    arrow.y = clamp(arrow.y, 5, VIEWPORT.height - 5);
    arrow.vx = 0;
    arrow.vy = 0;
    arrow.pickupDelay = .22;
  }

  private pointInsidePlatform(x: number, y: number): boolean {
    return PLATFORMS.some(platform => x >= platform.x && x <= platform.x + platform.w && y >= platform.y && y <= platform.y + platform.h);
  }

  private kill(victim: Fighter, killerId: string | null, song: string): void {
    if (!victim.alive || victim.invulnerableTime > 0) return;
    victim.alive = false;
    victim.deaths++;
    victim.respawnTime = COMBAT.respawnDelay;
    victim.vy = -260;
    victim.animation = 'ko';
    victim.animationTime = 0;
    if (victim.isPlayer) haptic([26, 24, 48]);
    else if (killerId === this.player.id) haptic([12, 16, 12]);
    const killer = this.fighters.find(fighter => fighter.id === killerId);
    if (killer && killer !== victim) killer.kills++;
    this.addFeed(`${killer?.name ?? 'The stage'} ♪ ${victim.name} · ${song}`, killer?.color ?? '#f0d07a');
    this.burst(victim.x + victim.w / 2, victim.y + victim.h / 2, victim.color, 25, 180);
    this.shake = 8;
    this.flash = .1;
  }

  private respawn(fighter: Fighter): void {
    const spawn = this.safeSpawn();
    fighter.x = spawn.x;
    fighter.y = spawn.y;
    fighter.previousX = spawn.x;
    fighter.previousY = spawn.y;
    fighter.vx = 0;
    fighter.vy = 0;
    fighter.alive = true;
    fighter.ammo = fighter.maxAmmo;
    fighter.invulnerableTime = COMBAT.spawnProtection;
    fighter.respawnTime = 0;
    fighter.animation = 'respawn';
    fighter.animationTime = 0;
    if (fighter.isPlayer) haptic([9, 24, 12]);
    this.burst(fighter.x + fighter.w / 2, fighter.y + fighter.h / 2, fighter.color, 16, 105, true);
  }

  private safeSpawn(): Vec2 {
    const alive = this.fighters.filter(fighter => fighter.alive);
    return SPAWNS.map(spawn => ({
      spawn,
      distance: alive.length ? Math.min(...alive.map(fighter => Math.hypot(fighter.x - spawn.x, fighter.y - spawn.y))) : 999
    })).sort((a, b) => b.distance - a.distance)[Math.floor(Math.random() * Math.min(3, SPAWNS.length))]!.spawn;
  }

  private burst(x: number, y: number, color: string, count: number, speed: number, collides = false): void {
    for (let index = 0; index < count; index++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (.4 + Math.random() * .8);
      this.particles.push({ x, y, vx:Math.cos(angle)*velocity, vy:Math.sin(angle)*velocity, color, life:.28+Math.random()*.38, size:2+Math.floor(Math.random()*3), gravity:220+Math.random()*260, collides, bounces:collides ? 2 : 0 });
    }
  }

  private addFeed(text: string, color: string): void {
    this.feed.unshift({ text, color, life:3.2 });
    this.feed.length = Math.min(this.feed.length, 4);
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      const previousY = particle.y;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.gravity * dt;
      particle.vx *= Math.pow(.2, dt);
      if (particle.collides && (particle.bounces ?? 0) > 0 && particle.vy > 0) {
        const platform = PLATFORMS.find(item => particle.x >= item.x && particle.x <= item.x + item.w && previousY <= item.y && particle.y >= item.y);
        if (platform) {
          particle.y = platform.y - particle.size;
          particle.vy = -Math.abs(particle.vy) * .34;
          particle.vx *= .68;
          particle.bounces = (particle.bounces ?? 1) - 1;
        }
      }
    }
    this.particles = this.particles.filter(particle => particle.life > 0);
    for (const item of this.feed) item.life -= dt;
    this.feed = this.feed.filter(item => item.life > 0);
    this.shake = Math.max(0, this.shake - 28 * dt);
    this.flash = Math.max(0, this.flash - dt);
  }
}
