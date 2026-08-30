import type { Action, HatId, LobbyProfile } from '../types/game';
import { InputManager } from '../engine/InputManager';

interface ChromeEvents {
  onClose: () => void;
  onPause: () => void;
  onFullscreen: () => void;
  onJoin: (profile: LobbyProfile) => void;
}

export class GameChrome {
  readonly canvas: HTMLCanvasElement;
  private readonly lobbyLayer: HTMLElement;

  constructor(root: HTMLElement, installed: boolean, input: InputManager, events: ChromeEvents, defaultName = 'Cole') {
    const hatStripUrl = new URL(`${import.meta.env.BASE_URL}assets/art/hat-strip.png`, document.baseURI).href;
    root.style.setProperty('--hat-strip', `url("${hatStripUrl}")`);
    root.innerHTML = `<main class="game-shell${installed ? ' is-installed' : ''}">
      <header class="game-bar">
        <div class="game-brand"><strong>Encore Royale</strong><span>your songs are your arrows</span></div>
        <div class="game-actions"><button data-action="pause" title="Pause (P)">Ⅱ</button><button data-action="fullscreen" title="Fullscreen (F)">□</button><button data-action="close" title="Return to BCD">×</button></div>
      </header>
      <div class="stage-wrap"><canvas id="game-canvas" width="960" height="540" tabindex="0"></canvas><div class="lobby-layer">
        <form class="character-card" autocomplete="off"><div class="lobby-kicker">Front of house</div><h1>Make your headliner</h1><p>Your fighter can run and hop here while the live arena carries on behind the glass.</p>
          <label class="name-field">Stage name<input name="playerName" maxlength="18" aria-label="Stage name"></label>
          <fieldset><legend>Color</legend><div class="color-choices"><button type="button" data-color="#ffd46f" data-accent="#8b4f7d" aria-label="Gold"></button><button type="button" data-color="#73ddf5" data-accent="#3e579d" aria-label="Blue"></button><button type="button" data-color="#ff7d96" data-accent="#873a70" aria-label="Pink"></button><button type="button" data-color="#a6ef85" data-accent="#477d68" aria-label="Green"></button><button type="button" data-color="#d99aff" data-accent="#704f9e" aria-label="Purple"></button></div></fieldset>
          <fieldset><legend>Hat</legend><div class="hat-choices"><button type="button" data-hat="cowboy"><span></span>Cowboy</button><button type="button" data-hat="crown"><span></span>Crown</button><button type="button" data-hat="beanie"><span></span>Beanie</button></div></fieldset>
          <button class="join-button" type="submit">Join the live game</button>
        </form>
        <div class="spawn-card" hidden><div class="lobby-kicker">Choose your entrance</div><h2>Pick a spotlight</h2><p>Move left or right, then press A or fire a note to drop in.</p></div>
      </div><div class="browser-help">MOVE ← → / A D · JUMP SPACE · NOTE X · DODGE C / SHIFT · AIM ↑ ↓</div></div>
      ${this.controllerMarkup()}
    </main>`;
    this.canvas = root.querySelector<HTMLCanvasElement>('#game-canvas')!;
    this.lobbyLayer = root.querySelector<HTMLElement>('.lobby-layer')!;
    root.querySelector('[data-action="close"]')?.addEventListener('click', events.onClose);
    root.querySelectorAll('[data-action="pause"]').forEach(button => button.addEventListener('click', events.onPause));
    root.querySelectorAll('[data-action="fullscreen"]').forEach(button => button.addEventListener('click', events.onFullscreen));
    root.querySelectorAll<HTMLElement>('[data-control]').forEach(button => this.bindControl(button, button.dataset.control as Action, input));
    this.bindLobby(events.onJoin, defaultName);
  }

  showSpawnSelection(): void {
    this.lobbyLayer.querySelector<HTMLElement>('.character-card')!.hidden = true;
    this.lobbyLayer.querySelector<HTMLElement>('.spawn-card')!.hidden = false;
    this.lobbyLayer.classList.add('is-spawning');
  }

  hideLobby(): void {
    this.lobbyLayer.classList.add('is-gone');
    setTimeout(() => { this.lobbyLayer.hidden = true; }, 520);
  }

  private bindLobby(onJoin: (profile: LobbyProfile) => void, defaultName: string): void {
    const form = this.lobbyLayer.querySelector<HTMLFormElement>('.character-card')!;
    const name = form.elements.namedItem('playerName') as HTMLInputElement;
    const saved = this.savedProfile(defaultName);
    name.value = saved.name;
    let color = saved.color;
    let accent = saved.accent;
    let hat: HatId = saved.hat;
    const sync = (): void => {
      form.querySelectorAll<HTMLElement>('[data-color]').forEach(button => button.classList.toggle('selected', button.dataset.color === color));
      form.querySelectorAll<HTMLElement>('[data-hat]').forEach(button => button.classList.toggle('selected', button.dataset.hat === hat));
    };
    form.querySelectorAll<HTMLElement>('[data-color]').forEach(button => button.addEventListener('click', () => { color=button.dataset.color!; accent=button.dataset.accent!; sync(); }));
    form.querySelectorAll<HTMLElement>('[data-hat]').forEach(button => button.addEventListener('click', () => { hat=button.dataset.hat as HatId; sync(); }));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const profile = { name:name.value.trim() || 'Cole', color, accent, hat };
      localStorage.setItem('encore-lobby-profile', JSON.stringify(profile));
      onJoin(profile);
      this.showSpawnSelection();
    });
    sync();
  }

  private savedProfile(defaultName: string): LobbyProfile {
    const fallback: LobbyProfile = { name:defaultName || 'Cole', color:'#ffd46f', accent:'#8b4f7d', hat:'crown' };
    try {
      const saved = JSON.parse(localStorage.getItem('encore-lobby-profile') || 'null');
      return saved?.name && saved?.color && ['cowboy','crown','beanie'].includes(saved.hat) ? saved : fallback;
    } catch { return fallback; }
  }

  private bindControl(button: HTMLElement, action: Action, input: InputManager): void {
    const down = (event: PointerEvent): void => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      button.classList.add('is-down');
      input.hold(action);
    };
    const up = (event: PointerEvent): void => {
      event.preventDefault();
      button.classList.remove('is-down');
      input.release(action);
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('contextmenu', event => event.preventDefault());
  }

  private controllerMarkup(): string {
    return `<div class="game-controller" aria-label="Retro game controller">
      <div class="dpad"><button class="pad up" data-control="up" aria-label="Aim up"></button><button class="pad left" data-control="left" aria-label="Move left"></button><span class="pad-center"></span><button class="pad right" data-control="right" aria-label="Move right"></button><button class="pad down" data-control="down" aria-label="Crouch or aim down"></button></div>
      <div class="center-controls"><label>SELECT<button data-action="fullscreen"></button></label><label>START<button data-action="pause"></button></label></div>
      <div class="action-controls"><label><button data-control="dodge">B</button>B</label><label><button data-control="jump">A</button>A</label><label><button data-control="shoot">♫</button>NOTE</label></div>
    </div>`;
  }
}
