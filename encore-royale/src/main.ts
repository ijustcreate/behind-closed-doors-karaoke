import './styles/main.css';
import { ParentBridge } from './bridge/ParentBridge';
import { InputManager } from './engine/InputManager';
import { EncoreRoyale } from './game/EncoreRoyale';
import { GameChrome } from './ui/GameChrome';

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (milliseconds: number) => void;
  }
}

const rootElement = document.querySelector<HTMLElement>('#game-root');
if (!rootElement) throw new Error('Encore Royale root element is missing.');
const root: HTMLElement = rootElement;

const bridge = new ParentBridge();
const input = new InputManager();
let game: EncoreRoyale | null = null;

function showGate(copy: string): void {
  root.innerHTML = `<main class="access-gate"><div class="access-mark">BCD<span>KC</span></div><h1>Encore stays backstage.</h1><p>${copy}</p></main>`;
}

function boot(session = bridge.getSession()): void {
  if (game || !session.installed) return;
  const chrome = new GameChrome(root, true, input, {
    onClose: () => bridge.requestClose(),
    onPause: () => game?.togglePause(),
    onFullscreen: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(),
    onJoin: profile => { game?.configurePlayer(profile); game?.beginJoin(); }
  }, session.playerName);
  game = new EncoreRoyale(chrome.canvas, session, input, () => chrome.hideLobby());
  game.start();
}

bridge.addEventListener('session', event => {
  const session = (event as CustomEvent).detail;
  if (!session.installed) {
    game?.stop();
    game = null;
    showGate('Add BCD Karaoke to your Home Screen to discover what is below the songbook.');
    return;
  }
  if (game) game.setSession(session);
  else boot(session);
});
bridge.addEventListener('command', event => {
  const command = (event as CustomEvent<'pause' | 'resume' | 'close'>).detail;
  if (command === 'pause') game?.setPaused(true);
  if (command === 'resume') game?.setPaused(false);
  if (command === 'close') game?.stop();
});

window.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'p' && !event.repeat) game?.togglePause();
  if (event.key.toLowerCase() === 'f' && !event.repeat) document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  if (event.key === 'Escape' && window.parent !== window) bridge.requestClose();
});

window.render_game_to_text = () => game?.toText() ?? JSON.stringify({ mode:'locked', installed:false });
window.advanceTime = milliseconds => game?.advanceTime(milliseconds);
bridge.connect();
if (bridge.isEmbedded()) showGate('Opening the backstage door…');
else if (bridge.getSession().installed) boot();
else showGate('Add BCD Karaoke to your Home Screen to discover what is below the songbook.');
