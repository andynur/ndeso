/**
 * The first-run benchmark (PERFORMANCE_BUDGET §4): skips a warm-up (shader compiles, first
 * texture uploads), then averages the frame time over a fixed window of real play. The
 * verdict itself is `benchmarkVerdict` in `render/quality/presets.ts`.
 */
export class Benchmark {
  private elapsedMs = 0;
  private measuredMs = 0;
  private frames = 0;
  private finished = false;

  constructor(
    private readonly warmupMs: number,
    private readonly durationMs: number,
  ) {}

  get done(): boolean {
    return this.finished;
  }

  /** Feeds one frame; returns the average frame time once, on the frame that completes it. */
  record(frameMs: number): number | undefined {
    if (this.finished) return undefined;
    this.elapsedMs += frameMs;
    if (this.elapsedMs <= this.warmupMs) return undefined;
    this.measuredMs += frameMs;
    this.frames++;
    if (this.measuredMs < this.durationMs) return undefined;
    this.finished = true;
    return this.measuredMs / this.frames;
  }
}
