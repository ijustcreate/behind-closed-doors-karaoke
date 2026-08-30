import type { GameSession, ParentMessage } from '../types/game';
import { FALLBACK_SONGS } from '../config/gameplay';

const params = new URLSearchParams(location.search);
const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
const localHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const developmentInstallPreview = (import.meta.env.DEV || localHost) && params.get('installed') === '1';

export class ParentBridge extends EventTarget {
  private trustedOrigin: string | null = null;
  private session: GameSession = {
    playerId: 'local-player',
    playerName: 'Cole',
    sungSongs: FALLBACK_SONGS.slice(),
    installed: developmentInstallPreview || matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true,
    roomId: 'backstage-local'
  };

  connect(): void {
    window.addEventListener('message', this.onMessage);
    if (window.parent !== window) window.parent.postMessage({ type: 'bcd:encore:ready' }, '*');
  }

  disconnect(): void { window.removeEventListener('message', this.onMessage); }
  isEmbedded(): boolean { return window.parent !== window; }
  getSession(): GameSession { return { ...this.session, sungSongs: [...this.session.sungSongs] }; }

  requestClose(): void {
    if (window.parent !== window) window.parent.postMessage({ type: 'bcd:encore:close' }, this.trustedOrigin || '*');
  }

  emitEvent(event: string, payload: unknown): void {
    if (window.parent !== window) window.parent.postMessage({ type: 'bcd:encore:event', event, payload }, this.trustedOrigin || '*');
  }

  private readonly onMessage = (event: MessageEvent<ParentMessage>): void => {
    if (!event.data || typeof event.data !== 'object' || !event.data.type?.startsWith('bcd:encore:')) return;
    if (this.trustedOrigin && event.origin !== this.trustedOrigin) return;
    if (event.data.type === 'bcd:encore:init') {
      this.trustedOrigin = event.origin;
      const payload = event.data.payload;
      this.session = {
        ...this.session,
        ...payload,
        sungSongs: Array.isArray(payload.sungSongs) && payload.sungSongs.length ? payload.sungSongs.slice(0, 50) : this.session.sungSongs
      };
      this.dispatchEvent(new CustomEvent('session', { detail: this.getSession() }));
    } else if (event.data.type === 'bcd:encore:command') {
      this.dispatchEvent(new CustomEvent('command', { detail: event.data.payload.command }));
    }
  };
}
