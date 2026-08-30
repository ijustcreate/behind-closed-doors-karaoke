export type GameMode = 'booting' | 'lobby' | 'spawn-select' | 'playing' | 'paused';
export type AnimationState = 'idle' | 'run' | 'jump' | 'fall' | 'land' | 'crouch' | 'wall-slide' | 'dodge' | 'shoot' | 'ko' | 'respawn';
export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'shoot' | 'dodge';
export type HatId = 'cowboy' | 'crown' | 'beanie';

export interface Vec2 { x: number; y: number }
export interface Platform extends Vec2 { w: number; h: number }

export interface Fighter extends Vec2 {
  id: string;
  name: string;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: -1 | 1;
  color: string;
  accent: string;
  hat: HatId;
  isPlayer: boolean;
  alive: boolean;
  animation: AnimationState;
  animationTime: number;
  grounded: boolean;
  coyoteTime: number;
  jumpBuffer: number;
  wallSide: -1 | 0 | 1;
  dashTime: number;
  dashCooldown: number;
  attackTime: number;
  invulnerableTime: number;
  respawnTime: number;
  landTime: number;
  ammo: number;
  maxAmmo: number;
  kills: number;
  deaths: number;
  songs: string[];
  songIndex: number;
  decisionTime: number;
  moveIntent: -1 | 0 | 1;
  jumpIntent: boolean;
  shootIntent: boolean;
  dodgeIntent: boolean;
}

export interface NoteArrow extends Vec2 {
  id: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  ownerId: string;
  song: string;
  color: string;
  state: 'flying' | 'stuck' | 'collected';
  age: number;
  labelTime: number;
  pickupDelay: number;
  angle: number;
}

export interface Particle extends Vec2 {
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
  gravity: number;
  collides?: boolean;
  bounces?: number;
}

export interface FeedItem {
  text: string;
  color: string;
  life: number;
}

export interface GameSession {
  playerId: string;
  playerName: string;
  sungSongs: string[];
  installed: boolean;
  roomId: string;
  accessToken?: string;
}

export interface GameSnapshot {
  mode: GameMode;
  time: number;
  player: Fighter;
  fighters: Fighter[];
  arrows: NoteArrow[];
  particles: Particle[];
  feed: FeedItem[];
  shake: number;
  flash: number;
  lobbyDepth: number;
  spawnIndex: number;
}

export interface LobbyProfile { name: string; color: string; accent: string; hat: HatId }

export interface ParentInitMessage {
  type: 'bcd:encore:init';
  payload: Partial<GameSession>;
}

export interface ParentCommandMessage {
  type: 'bcd:encore:command';
  payload: { command: 'pause' | 'resume' | 'close' };
}

export type ParentMessage = ParentInitMessage | ParentCommandMessage;
