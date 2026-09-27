/**
 * The camera rig, DESIGN §1.1: a critically damped follow with a dead zone, four fixed yaw
 * angles with an eased 250 ms turn, and a clamped zoom. Pure number crunching with no
 * `three` import, so the feel is unit-testable; `scene.ts` copies the pose onto the
 * `PerspectiveCamera` each frame.
 *
 * It runs on real frame time, not sim time: the camera must keep turning and settling
 * while the sim is paused (a menu, a cutscene hold).
 */

export const FOV_DEG = 30;
export const PITCH_DEG = 38;
export const DISTANCE_DEFAULT = 14;
export const DISTANCE_MIN = 10;
export const DISTANCE_MAX = 18;
export const YAW_TURN_SECONDS = 0.25;
export const FOLLOW_SMOOTH_SECONDS = 0.15;
export const DEAD_ZONE = 0.5;
/** Aim at a standing character's chest rather than their feet. */
export const LOOK_HEIGHT = 1.2;

const QUARTER = Math.PI / 2;
const PITCH = (PITCH_DEG * Math.PI) / 180;

export interface CameraPose {
  x: number;
  y: number;
  z: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

/** The facing a sprite should show for a world-space heading, as the camera sees it. */
export type ScreenFacing = 'down' | 'up' | 'side';

export interface CameraRigOptions {
  x?: number;
  z?: number;
  distance?: number;
}

export class CameraRig {
  /** Where the camera looks, smoothed; the follow target is `targetX/Z`. */
  focusX: number;
  focusZ: number;
  private goalX: number;
  private goalZ: number;
  private velX = 0;
  private velZ = 0;

  /** Unwrapped quarter-turn count; yaw angle = `yawStep * 90°`. */
  private yawStep = 0;
  private yawFrom = 0;
  private yawElapsed = YAW_TURN_SECONDS;
  /** Current displayed yaw in radians, unwrapped. */
  yaw = 0;

  private distanceGoal: number;
  private distanceVel = 0;
  distance: number;

  constructor({ x = 0, z = 0, distance = DISTANCE_DEFAULT }: CameraRigOptions = {}) {
    this.focusX = this.goalX = x;
    this.focusZ = this.goalZ = z;
    this.distance = this.distanceGoal = clampDistance(distance);
  }

  /** Which of the four angles the rig is at or turning to, 0–3 (0 looks towards -z). */
  get yawIndex(): number {
    return ((this.yawStep % 4) + 4) % 4;
  }

  get targetDistance(): number {
    return this.distanceGoal;
  }

  /**
   * Sets the point to follow. The goal only moves once the target leaves the dead zone,
   * and then just far enough to put it back on the zone's edge, so small steps and idle
   * fidgets do not drag the view.
   */
  follow(x: number, z: number): void {
    const dx = x - this.goalX;
    const dz = z - this.goalZ;
    const dist = Math.hypot(dx, dz);
    if (dist <= DEAD_ZONE) return;
    const k = (dist - DEAD_ZONE) / dist;
    this.goalX += dx * k;
    this.goalZ += dz * k;
  }

  /** Jumps straight to `x, z` with no easing — scene loads and warps. */
  snapTo(x: number, z: number): void {
    this.focusX = this.goalX = x;
    this.focusZ = this.goalZ = z;
    this.velX = this.velZ = 0;
  }

  /**
   * Turns one quarter: `+1` counter-clockwise seen from above, `-1` clockwise. A turn
   * requested mid-turn starts from where the camera is, so presses never snap.
   */
  rotate(direction: 1 | -1): void {
    this.yawFrom = this.yaw;
    this.yawStep += direction;
    this.yawElapsed = 0;
  }

  /** Zooms by `delta` world units (positive = out), clamped to DESIGN §1.1's range. */
  zoomBy(delta: number): void {
    this.distanceGoal = clampDistance(this.distanceGoal + delta);
  }

  update(dtSeconds: number): void {
    const dt = Math.max(dtSeconds, 0);
    this.focusX = smoothDamp(this.focusX, this.goalX, this.velX, FOLLOW_SMOOTH_SECONDS, dt, DAMP);
    this.velX = DAMP.velocity;
    this.focusZ = smoothDamp(this.focusZ, this.goalZ, this.velZ, FOLLOW_SMOOTH_SECONDS, dt, DAMP);
    this.velZ = DAMP.velocity;
    this.distance = smoothDamp(
      this.distance,
      this.distanceGoal,
      this.distanceVel,
      FOLLOW_SMOOTH_SECONDS,
      dt,
      DAMP,
    );
    this.distanceVel = DAMP.velocity;

    this.yawElapsed = Math.min(this.yawElapsed + dt, YAW_TURN_SECONDS);
    const t = easeInOutCubic(this.yawElapsed / YAW_TURN_SECONDS);
    const yawTo = this.yawStep * QUARTER;
    this.yaw = this.yawFrom + (yawTo - this.yawFrom) * t;
  }

  /** Writes the camera position and look-at point into `out` (reused, no allocation). */
  pose(out: CameraPose): CameraPose {
    const flat = Math.cos(PITCH) * this.distance;
    out.lookX = this.focusX;
    out.lookY = LOOK_HEIGHT;
    out.lookZ = this.focusZ;
    out.x = this.focusX + Math.sin(this.yaw) * flat;
    out.y = LOOK_HEIGHT + Math.sin(PITCH) * this.distance;
    out.z = this.focusZ + Math.cos(this.yaw) * flat;
    return out;
  }

  /**
   * The sprite facing for a world heading `(dx, dz)` under the current yaw: towards the
   * camera is `down`, away is `up`, otherwise `side`, mirrored when it points screen-left.
   * Characters keep their world heading while the camera turns, so their drawn facing
   * has to follow the camera. Writes into `out` so the per-sprite call does not allocate.
   */
  screenFacing(dx: number, dz: number, out: Facing): Facing {
    return screenFacing(dx, dz, this.yaw, out);
  }
}

export interface Facing {
  facing: ScreenFacing;
  flipX: boolean;
}

export function screenFacing(dx: number, dz: number, yaw: number, out: Facing): Facing {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const right = dx * cos - dz * sin;
  const toward = dx * sin + dz * cos;
  if (Math.abs(right) > Math.abs(toward)) {
    out.facing = 'side';
    out.flipX = right < 0;
  } else {
    out.facing = toward >= 0 ? 'down' : 'up';
    out.flipX = false;
  }
  return out;
}

export function clampDistance(distance: number): number {
  return Math.min(Math.max(distance, DISTANCE_MIN), DISTANCE_MAX);
}

export function easeInOutCubic(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** The spring's outgoing velocity, alongside the value `smoothDamp` returns. */
export interface DampState {
  velocity: number;
}

const DAMP: DampState = { velocity: 0 };

/**
 * Critically damped spring towards `target` (Game Programming Gems 4, §1.10): no
 * overshoot, frame-rate independent, and `smoothTime` is roughly the time to settle.
 * Returns the new value and writes the new velocity into `out`.
 */
export function smoothDamp(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  dt: number,
  out: DampState,
): number {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  const value = target + (change + temp) * exp;
  // The polynomial approximation can overshoot on a long frame; land on the target instead.
  if (target - current > 0 === value > target) {
    out.velocity = 0;
    return target;
  }
  out.velocity = (velocity - omega * temp) * exp;
  return value;
}
