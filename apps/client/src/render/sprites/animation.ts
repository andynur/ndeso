import { getTag, type SpriteAtlas } from './atlas.ts';

/**
 * Frame index shown `elapsedSeconds` after a looping animation started. Frame durations
 * come from the atlas, so an animator can hold a frame longer without a code change.
 * Negative elapsed time (a start scheduled in the future) shows the first frame.
 */
export function frameAt(atlas: SpriteAtlas, tagName: string, elapsedSeconds: number): number {
  const { from, to } = getTag(atlas, tagName);
  let cycleMs = 0;
  for (let i = from; i <= to; i++) cycleMs += atlas.frames[i]?.durationMs ?? 0;
  if (cycleMs <= 0 || elapsedSeconds <= 0) return from;

  let t = (elapsedSeconds * 1000) % cycleMs;
  for (let i = from; i < to; i++) {
    t -= atlas.frames[i]?.durationMs ?? 0;
    if (t < 0) return i;
  }
  return to;
}
