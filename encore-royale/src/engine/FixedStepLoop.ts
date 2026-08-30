export class FixedStepLoop {
  private frameId = 0;
  private previous = 0;
  private accumulator = 0;

  constructor(
    private readonly step: number,
    private readonly update: (seconds: number) => void,
    private readonly render: () => void
  ) {}

  start(): void {
    this.stop();
    this.previous = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.accumulator = 0;
  }

  advance(milliseconds: number): void {
    const frames = Math.max(1, Math.round(milliseconds / (this.step * 1000)));
    for (let index = 0; index < frames; index++) this.update(this.step);
    this.render();
  }

  private readonly tick = (timestamp: number): void => {
    const elapsed = Math.min(.05, (timestamp - this.previous) / 1000 || this.step);
    this.previous = timestamp;
    this.accumulator += elapsed;
    while (this.accumulator >= this.step) {
      this.update(this.step);
      this.accumulator -= this.step;
    }
    this.render();
    this.frameId = requestAnimationFrame(this.tick);
  };
}

