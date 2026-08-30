import { PLATFORMS, SPAWNS, VIEWPORT } from '../config/gameplay';
import type { Fighter, GameMode, GameSnapshot, NoteArrow } from '../types/game';

interface Pose {
  sx: number; sy: number; bob: number; tilt: number; arm: number; legA: number; legB: number; alpha: number; smear: boolean;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly backdrop = this.loadImage('assets/art/arena-backdrop.jpg');
  private readonly lobbyApron = this.loadImage('assets/art/lobby-apron.png');
  private readonly hats = this.loadImage('assets/art/hat-strip.png');

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D rendering is unavailable.');
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
  }

  render(snapshot: GameSnapshot): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, VIEWPORT.width, VIEWPORT.height);
    if (snapshot.shake > 0) ctx.translate((Math.random() - .5) * snapshot.shake, (Math.random() - .5) * snapshot.shake);
    const inLobby = snapshot.mode === 'lobby' || snapshot.mode === 'spawn-select';
    if (inLobby) {
      ctx.save();
      ctx.filter = 'blur(3px) brightness(.76) saturate(.9)';
      this.drawWorld(snapshot, 1.48);
      ctx.restore();
      this.drawLobbyApron();
      if (snapshot.mode === 'spawn-select') this.drawSpawnSelection(snapshot);
      else this.drawLobbyPreviewStage(snapshot.player, snapshot.time);
      this.drawFighter(snapshot.player, snapshot.time, snapshot.mode === 'spawn-select' ? 3.5 - snapshot.lobbyDepth * 2.02 : 3.5, false);
    } else {
      ctx.save();
      this.applyGameplayCamera(snapshot.player);
      this.drawWorld(snapshot, 1.48);
      ctx.restore();
      this.drawHud(snapshot);
    }
    if (snapshot.flash > 0) {
      ctx.globalAlpha = snapshot.flash * 3;
      ctx.fillStyle = '#fff2c4';
      ctx.fillRect(0, 0, VIEWPORT.width, VIEWPORT.height);
    }
    ctx.restore();
  }

  private drawWorld(snapshot: GameSnapshot, fighterScale: number): void {
    const ctx = this.ctx;
    this.drawBackground(snapshot.time);
    snapshot.fighters.forEach(fighter => this.drawFighterContrast(fighter));
    snapshot.arrows.forEach(arrow => this.drawArrow(arrow, snapshot.player));
    snapshot.particles.forEach(particle => {
      ctx.globalAlpha = clamp(particle.life * 3, 0, 1);
      this.rect(particle.x, particle.y, particle.size, particle.size, particle.color);
    });
    ctx.globalAlpha = 1;
    snapshot.fighters.forEach(fighter => this.drawFighter(fighter, snapshot.time, fighterScale));
  }

  private applyGameplayCamera(player: Fighter): void {
    const { zoom, centerX, centerY } = this.gameplayCamera(player);
    this.ctx.translate(VIEWPORT.width / 2, VIEWPORT.height / 2);
    this.ctx.scale(zoom, zoom);
    this.ctx.translate(-centerX, -centerY);
  }

  private gameplayCamera(player: Fighter): { zoom:number; centerX:number; centerY:number } {
    const zoom = 1.72;
    const halfWidth = VIEWPORT.width / (zoom * 2);
    const halfHeight = VIEWPORT.height / (zoom * 2);
    const centerX = clamp(player.x + player.w / 2, halfWidth, VIEWPORT.width - halfWidth);
    const centerY = clamp(player.y + player.h / 2, halfHeight, VIEWPORT.height - halfHeight);
    return { zoom, centerX, centerY };
  }

  private loadImage(path: string): HTMLImageElement {
    const image = new Image();
    image.src = `${import.meta.env.BASE_URL}${path}`;
    return image;
  }

  private rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  private text(text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left'): void {
    this.ctx.font = `800 ${size}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'alphabetic';
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
  }

  private drawBackground(time: number): void {
    const ctx = this.ctx;
    if (this.backdrop.complete && this.backdrop.naturalWidth) {
      ctx.drawImage(this.backdrop, 0, 0, VIEWPORT.width, VIEWPORT.height);
    } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEWPORT.height);
    gradient.addColorStop(0, '#211444');
    gradient.addColorStop(.62, '#100f2b');
    gradient.addColorStop(1, '#090a19');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEWPORT.width, VIEWPORT.height);
    }

    ctx.fillStyle = 'rgba(255,215,126,.055)';
    ctx.beginPath(); ctx.moveTo(385, 0); ctx.lineTo(505, 492); ctx.lineTo(630, 492); ctx.lineTo(540, 0); ctx.fill();

    for (let index = 0; index < 58; index++) {
      const x = (index * 157 + 41) % VIEWPORT.width;
      const y = (index * 83 + 19) % 385;
      ctx.globalAlpha = .3 + .7 * Math.abs(Math.sin(time * 1.6 + index));
      this.rect(x, y, index % 7 ? 2 : 3, index % 7 ? 2 : 3, index % 7 ? '#6d5796' : '#f2d184');
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#100a1b';
    ctx.beginPath(); ctx.moveTo(0, 70); ctx.quadraticCurveTo(118, 120, 204, 42); ctx.lineTo(204, 0); ctx.lineTo(0, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(960, 70); ctx.quadraticCurveTo(842, 120, 756, 42); ctx.lineTo(756, 0); ctx.lineTo(960, 0); ctx.fill();
    this.text('ENCORE', 480, 62, 28, '#f2cf7a', 'center');
    this.text('ROYALE', 480, 88, 20, '#c99be0', 'center');
    for (const platform of PLATFORMS) this.drawOrnatePlatform(platform);
  }

  private drawFighterContrast(fighter: Fighter): void {
    if (!fighter.alive) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(fighter.x + fighter.w / 2, fighter.y + fighter.h / 2);
    ctx.scale(1.45, 1);
    const shade = ctx.createRadialGradient(0, 0, 5, 0, 0, 46);
    shade.addColorStop(0, 'rgba(4,2,10,.44)');
    shade.addColorStop(.58, 'rgba(4,2,10,.24)');
    shade.addColorStop(1, 'rgba(4,2,10,0)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawOrnatePlatform(platform: { x:number; y:number; w:number; h:number }): void {
    const ctx = this.ctx;
    const ground = platform.y >= 490;
    const apron = ground ? platform.h : Math.max(13, platform.h + 7);
    this.rect(platform.x, platform.y, platform.w, apron, '#1a101a');
    this.rect(platform.x, platform.y, platform.w, 3, '#f0c462');
    this.rect(platform.x + 2, platform.y + 3, Math.max(0, platform.w - 4), 4, '#71323d');
    this.rect(platform.x + 5, platform.y + 7, Math.max(0, platform.w - 10), 3, '#c58a3d');
    if (ground) {
      this.rect(platform.x, platform.y + 11, platform.w, platform.h - 11, '#351421');
      return;
    }
    for (let x = platform.x + 8; x < platform.x + platform.w - 5; x += 24) {
      ctx.fillStyle = '#8b243e';
      ctx.beginPath();
      ctx.moveTo(x - 8, platform.y + 10);
      ctx.quadraticCurveTo(x, platform.y + 19, x + 8, platform.y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#efc466';
      ctx.beginPath();
      ctx.arc(x, platform.y + 9, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    this.rect(platform.x + 3, platform.y + apron - 2, Math.max(0, platform.w - 6), 2, '#6b3e32');
  }

  private drawLobbyApron(): void {
    const ctx = this.ctx;
    if (this.lobbyApron.complete && this.lobbyApron.naturalWidth) ctx.drawImage(this.lobbyApron, 0, 0, VIEWPORT.width, VIEWPORT.height);
    else {
      const gradient = ctx.createLinearGradient(0, 388, 0, VIEWPORT.height);
      gradient.addColorStop(0, 'rgba(55,21,43,.2)');
      gradient.addColorStop(.18, '#7b1838');
      gradient.addColorStop(.24, '#d4a34e');
      gradient.addColorStop(.28, '#351825');
      gradient.addColorStop(1, '#100a11');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 380, VIEWPORT.width, 160);
    }
  }

  private drawLobbyPreviewStage(fighter: Fighter, time: number): void {
    const ctx = this.ctx;
    const fighterCenter = fighter.x + fighter.w / 2;
    const pulse = .82 + Math.sin(time * 2.4) * .08;

    ctx.save();
    const beam = ctx.createLinearGradient(fighterCenter, 58, fighterCenter, 470);
    beam.addColorStop(0, 'rgba(255,230,157,.03)');
    beam.addColorStop(.55, `rgba(255,218,122,${.08 * pulse})`);
    beam.addColorStop(1, `rgba(255,205,102,${.22 * pulse})`);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(fighterCenter - 25, 46);
    ctx.lineTo(fighterCenter + 25, 46);
    ctx.lineTo(fighterCenter + 105, 468);
    ctx.lineTo(fighterCenter - 105, 468);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(255,221,137,${.31 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(fighterCenter, 465, 73, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    this.rect(64, 466, 832, 8, '#d2a34f');
    this.rect(64, 474, 832, 38, '#261126');
    this.rect(72, 478, 816, 29, '#120b1d');
    this.rect(72, 478, 816, 2, '#70425f');
    for (let x = 84; x < 888; x += 30) {
      ctx.fillStyle = '#f2c76a';
      ctx.beginPath();
      ctx.arc(x, 470, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const nameplateX = clamp(fighterCenter, 180, 780);
    this.rect(nameplateX - 105, 480, 210, 31, '#090712');
    this.rect(nameplateX - 105, 480, 210, 2, '#9a6840');
    this.text('YOUR HEADLINER', nameplateX, 490, 12, '#c79fd0', 'center');
    const label = fighter.name.trim().toUpperCase() || 'COLE';
    this.text(label.length > 18 ? `${label.slice(0, 17)}…` : label, nameplateX, 507, 22, '#ffe09a', 'center');
    ctx.restore();
  }

  private drawSpawnSelection(snapshot: GameSnapshot): void {
    SPAWNS.forEach((spawn, index) => {
      const selected = index === snapshot.spawnIndex;
      this.ctx.globalAlpha = selected ? .9 : .25;
      this.ctx.fillStyle = selected ? '#ffd66e' : '#8e69ab';
      this.ctx.beginPath();
      this.ctx.ellipse(spawn.x + 11, spawn.y + 31, selected ? 34 : 21, selected ? 9 : 5, 0, 0, Math.PI * 2);
      this.ctx.fill();
      if (selected) {
        this.ctx.fillStyle = 'rgba(255,222,132,.12)';
        this.ctx.beginPath();
        this.ctx.moveTo(spawn.x - 15, 0);
        this.ctx.lineTo(spawn.x + 48, 0);
        this.ctx.lineTo(spawn.x + 40, spawn.y + 30);
        this.ctx.lineTo(spawn.x - 8, spawn.y + 30);
        this.ctx.fill();
      }
    });
    this.ctx.globalAlpha = 1;
    this.text('←  PICK A SPOTLIGHT  →', 480, 518, 11, '#ffe6a1', 'center');
  }

  private pose(fighter: Fighter): Pose {
    const t = fighter.animationTime;
    const pose: Pose = { sx:1, sy:1, bob:0, tilt:0, arm:0, legA:0, legB:0, alpha:1, smear:false };
    switch (fighter.animation) {
      case 'idle': pose.bob = Math.sin(t * 4.6) * 1.2; pose.arm = Math.sin(t * 3.2) * 1.2; break;
      case 'run': { const cycle = Math.sin(t * 15); pose.bob = Math.abs(cycle) * -2; pose.legA = cycle * 5; pose.legB = -cycle * 5; pose.arm = -cycle * 4; pose.sx = 1.04; pose.sy = .97; break; }
      case 'jump': pose.sx = .89; pose.sy = 1.13; pose.legA = -3; pose.legB = 3; break;
      case 'fall': pose.sx = 1.08; pose.sy = .94; pose.legA = 2; pose.legB = -2; break;
      case 'land': pose.sx = 1.19; pose.sy = .78; pose.bob = 5; break;
      case 'wall-slide': pose.tilt = fighter.wallSide * -.12; pose.legA = -3; pose.legB = 4; pose.arm = 4; break;
      case 'crouch': pose.sx = 1.13; pose.sy = .72; pose.bob = 8; break;
      case 'shoot': pose.sx = 1.08; pose.sy = .95; pose.arm = 8; pose.tilt = -.06; break;
      case 'dodge': pose.sx = 1.38; pose.sy = .68; pose.bob = 7; pose.smear = true; break;
      case 'respawn': pose.alpha = clamp(fighter.animationTime / .4, 0, 1); pose.sy = .5 + pose.alpha * .5; break;
      case 'ko': pose.tilt = fighter.animationTime * 8; pose.sx = 1.06; pose.sy = .92; pose.alpha = clamp(fighter.respawnTime, 0, 1); break;
    }
    return pose;
  }

  private drawFighter(fighter: Fighter, time: number, depthScale = 1, drawLabels = true): void {
    const ctx = this.ctx;
    const pose = this.pose(fighter);
    const centerX = fighter.x + fighter.w / 2;
    const bottom = fighter.y + fighter.h;
    ctx.save();
    ctx.globalAlpha = pose.alpha * (fighter.invulnerableTime > 0 && Math.floor(time * 18) % 2 ? .45 : 1);
    ctx.translate(Math.round(centerX), Math.round(bottom + pose.bob));
    ctx.scale(depthScale, depthScale);
    ctx.scale(fighter.facing * pose.sx, pose.sy);
    ctx.rotate(pose.tilt);
    if (pose.smear) {
      ctx.globalAlpha *= .24;
      this.rect(-fighter.facing * 25 - 8, -22, 27, 15, fighter.color);
      ctx.globalAlpha = pose.alpha;
    }
    this.rect(-8 + pose.legA, -7, 7, 8, fighter.accent);
    this.rect(2 + pose.legB, -7, 7, 8, fighter.accent);
    this.rect(-10, -22, 20, 17, fighter.color);
    this.rect(-8, -28, 17, 10, fighter.color);
    this.rect(-9, -30, 18, 5, fighter.accent);
    this.rect(-13 - pose.arm, -20, 5, 12, fighter.color);
    this.rect(8 + pose.arm, -20, 6 + (fighter.animation === 'shoot' ? 7 : 0), 6, fighter.color);
    this.rect(3, -25, 3, 3, '#261837');
    this.rect(-1, -18, 3, 3, '#fff0b3');
    this.drawHat(fighter);
    ctx.restore();
    if (fighter.alive && drawLabels) {
      this.text(fighter.name, centerX, fighter.y - 8, 9, fighter.isPlayer ? '#ffe29b' : '#cabbe2', 'center');
      for (let i = 0; i < fighter.maxAmmo; i++) this.text(i < fighter.ammo ? '♪' : '·', centerX - 6 + i * 12, fighter.y - 18, 11, i < fighter.ammo ? fighter.color : '#5a4c6d', 'center');
    }
  }

  private drawHat(fighter: Fighter): void {
    if (!this.hats.complete || !this.hats.naturalWidth) return;
    const order = { cowboy:0, crown:1, beanie:2 } as const;
    const cellWidth = this.hats.naturalWidth / 3;
    const sourceX = order[fighter.hat] * cellWidth;
    const sourceY = this.hats.naturalHeight * .31;
    const sourceHeight = this.hats.naturalHeight * .3;
    this.ctx.drawImage(this.hats, sourceX, sourceY, cellWidth, sourceHeight, -18, -43, 36, 18);
  }

  private drawArrow(arrow: NoteArrow, player: Fighter): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(Math.round(arrow.x), Math.round(arrow.y));
    ctx.rotate(arrow.angle);
    const trail = ctx.createLinearGradient(-43, 0, 3, 0);
    trail.addColorStop(0, 'rgba(255,255,255,0)');
    trail.addColorStop(.45, `${arrow.color}33`);
    trail.addColorStop(1, arrow.color);
    ctx.fillStyle = trail;
    ctx.beginPath(); ctx.moveTo(-43, 0); ctx.lineTo(3, -5); ctx.lineTo(3, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(8,4,15,.92)';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-8, 1); ctx.lineTo(11, 1); ctx.stroke();
    ctx.strokeStyle = arrow.color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-8, 1); ctx.lineTo(11, 1); ctx.stroke();
    ctx.fillStyle = '#0b0712';
    ctx.beginPath(); ctx.ellipse(10, 4, 7, 5.5, -.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe59a';
    ctx.beginPath(); ctx.ellipse(10, 3, 5, 4, -.2, 0, Math.PI * 2); ctx.fill();
    this.rect(13, -11, 3, 15, '#ffe59a');
    ctx.strokeStyle = '#ffe59a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(15, -10); ctx.quadraticCurveTo(24, -8, 20, -2); ctx.stroke();
    ctx.restore();
    const playerX = player.x + player.w / 2;
    const playerY = player.y + player.h / 2;
    const relevant = arrow.ownerId === player.id || Math.hypot(arrow.x - playerX, arrow.y - playerY) < 165 || arrow.state === 'stuck';
    if (arrow.labelTime > 0 && relevant) this.drawArrowLabel(arrow);
  }

  private drawArrowLabel(arrow: NoteArrow): void {
    const ctx = this.ctx;
    const label = arrow.song.length > 25 ? `${arrow.song.slice(0, 24)}…` : arrow.song;
    ctx.font = '800 9px ui-monospace, SFMono-Regular, Consolas, monospace';
    const width = Math.min(166, ctx.measureText(label).width + 14);
    const x = clamp(arrow.x, width / 2 + 5, VIEWPORT.width - width / 2 - 5);
    const y = arrow.y - 16;
    this.rect(x - width / 2, y - 13, width, 17, 'rgba(9,7,20,.88)');
    this.rect(x - width / 2, y + 2, width, 2, arrow.color);
    this.text(label, x, y, 9, '#f5e7ba', 'center');
  }

  private drawHud(snapshot: GameSnapshot): void {
    const player = snapshot.player;
    this.rect(14, 13, 252, 46, 'rgba(9,7,20,.78)');
    this.rect(14, 13, 4, 46, player.color);
    this.text(`${player.name.toUpperCase()}  ${player.kills} ENCORES`, 27, 32, 13, '#ffe09b');
    this.text(`${player.deaths} MIC DROPS  ·  ${player.ammo}/${player.maxAmmo} NOTES`, 27, 49, 9, '#ad9abe');
    snapshot.feed.slice(0, 3).forEach((item, index) => {
      this.ctx.globalAlpha = clamp(item.life, 0, 1);
      this.text(item.text, 944, 24 + index * 15, 9, item.color, 'right');
    });
    this.ctx.globalAlpha = 1;
    if (!player.alive) {
      const camera = this.gameplayCamera(player);
      const x = clamp(VIEWPORT.width / 2 + (player.x + player.w / 2 - camera.centerX) * camera.zoom, 78, VIEWPORT.width - 78);
      const y = clamp(VIEWPORT.height / 2 + (player.y - 42 - camera.centerY) * camera.zoom, 76, VIEWPORT.height - 82);
      this.rect(x - 70, y - 24, 140, 42, 'rgba(8,6,18,.9)');
      this.rect(x - 70, y + 15, 140, 3, player.color);
      this.text('MIC DROP!', x, y - 3, 16, '#ffd77d', 'center');
      this.text(`BACK IN ${Math.max(1, Math.ceil(player.respawnTime))}`, x, y + 12, 8, '#c9add9', 'center');
    }
    if (snapshot.mode === 'paused') this.drawPauseOverlay(snapshot.mode);
  }

  private drawPauseOverlay(_mode: GameMode): void {
    this.rect(0, 0, 960, 540, 'rgba(5,4,13,.72)');
    this.text('PAUSED', 480, 265, 30, '#ffe09a', 'center');
    this.text('PRESS START OR P', 480, 293, 11, '#bba9cf', 'center');
  }
}
