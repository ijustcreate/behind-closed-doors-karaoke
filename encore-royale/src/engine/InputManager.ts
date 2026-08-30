import type { Action } from '../types/game';

const keyMap: Readonly<Record<string, Action>> = {
  arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
  arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down',
  ' ': 'jump', z: 'jump', x: 'shoot', enter: 'shoot', c: 'dodge', shift: 'dodge'
};

export class InputManager {
  private readonly down = new Set<Action>();
  private readonly pressed = new Set<Action>();

  constructor(private readonly target: Window = window) {}

  connect(): void {
    this.target.addEventListener('keydown', this.onKeyDown, true);
    this.target.addEventListener('keyup', this.onKeyUp, true);
    this.target.addEventListener('blur', this.clear);
  }

  disconnect(): void {
    this.target.removeEventListener('keydown', this.onKeyDown, true);
    this.target.removeEventListener('keyup', this.onKeyUp, true);
    this.target.removeEventListener('blur', this.clear);
    this.clear();
  }

  hold(action: Action): void {
    if (!this.down.has(action)) this.pressed.add(action);
    this.down.add(action);
  }

  release(action: Action): void { this.down.delete(action); }
  isDown(action: Action): boolean { return this.down.has(action); }

  consume(action: Action): boolean {
    const value = this.pressed.has(action);
    this.pressed.delete(action);
    return value;
  }

  endFrame(): void { this.pressed.clear(); }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const action = keyMap[event.key.toLowerCase()];
    if (!action) return;
    this.hold(action);
    event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = keyMap[event.key.toLowerCase()];
    if (!action) return;
    this.release(action);
    event.preventDefault();
  };

  private readonly clear = (): void => {
    this.down.clear();
    this.pressed.clear();
  };
}

