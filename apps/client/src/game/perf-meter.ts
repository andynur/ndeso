/**
 * Frame timing for the `?debug=perf` overlay (PERFORMANCE_BUDGET §6). Averages over a short
 * window so the numbers are readable rather than flickering per frame; allocates nothing.
 */

/** How often the overlay gets a new reading. */
export const PERF_WINDOW_MS = 500;

export interface FrameTimings {
  /** Frames per real second over the window. */
  fps: number;
  /** Mean wall-clock time between drawn frames. */
  frameMs: number;
  /** Mean CPU time inside the frame (input, sim steps, render submit): the §3 12 ms budget. */
  cpuMs: number;
  /** Worst single CPU frame in the window: a hitch the mean hides. */
  cpuMaxMs: number;
}

export class PerfMeter {
  readonly latest: FrameTimings = { fps: 0, frameMs: 0, cpuMs: 0, cpuMaxMs: 0 };
  private elapsedMs = 0;
  private frames = 0;
  private cpuTotalMs = 0;
  private cpuMaxMs = 0;

  /** Records one frame; returns true when `latest` was refreshed. */
  record(frameMs: number, cpuMs: number): boolean {
    this.elapsedMs += Math.max(0, frameMs);
    this.frames++;
    this.cpuTotalMs += cpuMs;
    if (cpuMs > this.cpuMaxMs) this.cpuMaxMs = cpuMs;
    if (this.elapsedMs < PERF_WINDOW_MS) return false;

    const { latest } = this;
    latest.fps = (this.frames * 1000) / this.elapsedMs;
    latest.frameMs = this.elapsedMs / this.frames;
    latest.cpuMs = this.cpuTotalMs / this.frames;
    latest.cpuMaxMs = this.cpuMaxMs;
    this.elapsedMs = 0;
    this.frames = 0;
    this.cpuTotalMs = 0;
    this.cpuMaxMs = 0;
    return true;
  }
}
