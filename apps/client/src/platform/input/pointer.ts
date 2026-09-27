import type { InputFrame } from './input-frame.ts';

/**
 * Touch and mouse, GDD §12. Pure state fed from pointer events in CSS pixels, so it runs
 * under `bun test` without a DOM; `attachPointer` is the only part that touches one.
 *
 * - **Virtual joystick:** a touch that lands in the left 40 % of the screen (DESIGN §5)
 *   plants the stick where it landed — a floating stick fits every thumb and every phone.
 * - **Two fingers:** a sideways swipe turns the camera one quarter, once per gesture; a
 *   pinch zooms. The stick lets go the moment a second finger lands.
 * - **Mouse:** a click without a drag is interact ("Space / E / click"). A mouse never
 *   plants the stick — desktop moves on the keyboard.
 */

/** Share of the screen width, from the left, where a touch plants the stick (DESIGN §5). */
export const STICK_ZONE = 0.4;
/** Stick travel in CSS px for full speed. */
export const STICK_RADIUS_PX = 56;
/** Fraction of the radius ignored around the centre, so a resting thumb does not creep. */
export const STICK_DEAD_ZONE = 0.15;
/** Two-finger sideways travel that counts as a turn. */
export const SWIPE_TURN_PX = 60;
/** Change in finger spread per world unit of zoom. */
export const PINCH_PX_PER_UNIT = 24;
/** A mouse press that moves further than this is a drag, not a click. */
export const CLICK_SLOP_PX = 6;

/** What the overlay draws for the stick: where it was planted and where the knob sits. */
export interface StickView {
  readonly originX: number;
  readonly originY: number;
  /** Knob offset from the origin, clamped to `STICK_RADIUS_PX`. */
  readonly knobX: number;
  readonly knobY: number;
}

export type PointerKind = 'mouse' | 'touch' | 'pen';

export interface PointerSource {
  /** `viewportWidth` decides whether the press landed in the stick zone. */
  down(id: number, kind: PointerKind, x: number, y: number, viewportWidth: number): void;
  move(id: number, x: number, y: number): void;
  up(id: number): void;
  /** Pointer cancelled by the browser (a system gesture, an alert): no click, no stick. */
  cancel(id: number): void;
  sample(frame: InputFrame): void;
}

interface Contact {
  kind: PointerKind;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

/**
 * Maps a stick offset in px to a screen-relative move (`+y` up), length ≤ 1, with the dead
 * zone removed so the speed still ramps from zero at its edge.
 */
export function stickVector(
  dx: number,
  dy: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const distance = Math.hypot(dx, dy);
  const magnitude = Math.min(distance / STICK_RADIUS_PX, 1);
  if (magnitude <= STICK_DEAD_ZONE) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const scaled = (magnitude - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE);
  out.x = (dx / distance) * scaled;
  // Screen y grows downwards; "up the screen" is forward.
  out.y = (-dy / distance) * scaled;
  return out;
}

export function createPointerSource(onStick: (view: StickView | null) => void): PointerSource {
  const contacts = new Map<number, Contact>();
  let stickId = -1;
  let gesture: { startMidX: number; spread: number; turned: boolean } | null = null;
  let interact = false;
  let rotate = 0;
  let zoom = 0;
  const vector = { x: 0, y: 0 };

  function releaseStick(): void {
    if (stickId === -1) return;
    stickId = -1;
    onStick(null);
  }

  function twoContacts(): [Contact, Contact] | null {
    if (contacts.size !== 2) return null;
    const [a, b] = contacts.values();
    return a && b ? [a, b] : null;
  }

  function startGesture(): void {
    const pair = twoContacts();
    gesture = pair
      ? {
          startMidX: (pair[0].x + pair[1].x) / 2,
          spread: Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y),
          turned: false,
        }
      : null;
  }

  function stickView(contact: Contact): StickView {
    const dx = contact.x - contact.startX;
    const dy = contact.y - contact.startY;
    const distance = Math.hypot(dx, dy);
    const scale = distance > STICK_RADIUS_PX ? STICK_RADIUS_PX / distance : 1;
    return {
      originX: contact.startX,
      originY: contact.startY,
      knobX: dx * scale,
      knobY: dy * scale,
    };
  }

  function end(id: number, cancelled: boolean): void {
    const contact = contacts.get(id);
    if (!contact) return;
    contacts.delete(id);
    if (
      !cancelled &&
      contact.kind === 'mouse' &&
      Math.hypot(contact.x - contact.startX, contact.y - contact.startY) <= CLICK_SLOP_PX
    ) {
      interact = true;
    }
    if (id === stickId) releaseStick();
    // Lifting one of two fingers ends the gesture; the other finger does not become a stick.
    if (contacts.size < 2) gesture = null;
  }

  return {
    down(id, kind, x, y, viewportWidth) {
      contacts.set(id, { kind, startX: x, startY: y, x, y });
      if (contacts.size === 2) {
        releaseStick();
        startGesture();
        return;
      }
      if (contacts.size === 1 && kind !== 'mouse' && x < viewportWidth * STICK_ZONE) {
        stickId = id;
        onStick({ originX: x, originY: y, knobX: 0, knobY: 0 });
      }
    },
    move(id, x, y) {
      const contact = contacts.get(id);
      if (!contact) return;
      contact.x = x;
      contact.y = y;
      if (id === stickId) {
        onStick(stickView(contact));
        return;
      }
      const pair = gesture ? twoContacts() : null;
      if (!gesture || !pair) return;
      const [a, b] = pair;
      const spread = Math.hypot(a.x - b.x, a.y - b.y);
      // Fingers apart = closer in, like pinch-to-zoom everywhere else.
      zoom += (gesture.spread - spread) / PINCH_PX_PER_UNIT;
      gesture.spread = spread;
      const travel = (a.x + b.x) / 2 - gesture.startMidX;
      if (!gesture.turned && Math.abs(travel) >= SWIPE_TURN_PX) {
        // Swiping drags the world the way the fingers go: right turns clockwise from above.
        rotate += travel > 0 ? -1 : 1;
        gesture.turned = true;
      }
    },
    up(id) {
      end(id, false);
    },
    cancel(id) {
      end(id, true);
    },
    sample(frame) {
      const stick = contacts.get(stickId);
      if (stick) {
        stickVector(stick.x - stick.startX, stick.y - stick.startY, vector);
        frame.moveX += vector.x;
        frame.moveY += vector.y;
      }
      if (interact) frame.interact = true;
      frame.rotate += rotate;
      frame.zoom += zoom;
      interact = false;
      rotate = 0;
      zoom = 0;
    },
  };
}

/** Wires a canvas's pointer events into `source`. Returns the detach function. */
export function attachPointer(canvas: HTMLElement, source: PointerSource): () => void {
  const onDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    source.down(
      event.pointerId,
      event.pointerType as PointerKind,
      event.clientX,
      event.clientY,
      canvas.clientWidth,
    );
  };
  const onMove = (event: PointerEvent) =>
    source.move(event.pointerId, event.clientX, event.clientY);
  const onUp = (event: PointerEvent) => source.up(event.pointerId);
  const onCancel = (event: PointerEvent) => source.cancel(event.pointerId);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
  };
}
