import { describe, expect, test } from 'bun:test';
import { type Command, HOTBAR_SLOTS, sanitizeCommand } from './commands.ts';
import { createContext } from './types.ts';

describe('sanitizeCommand', () => {
  test('keeps a move inside the unit circle as is', () => {
    expect(sanitizeCommand({ type: 'move', x: 0.3, z: -0.4 })).toEqual({
      type: 'move',
      x: 0.3,
      z: -0.4,
    });
  });

  test('scales a longer move back to length 1', () => {
    const out = sanitizeCommand({ type: 'move', x: 3, z: 4 });
    expect(out).toEqual({ type: 'move', x: 0.6, z: 0.8 });
  });

  test('rejects a move with a non-finite component', () => {
    expect(sanitizeCommand({ type: 'move', x: Number.NaN, z: 0 })).toBeNull();
    expect(sanitizeCommand({ type: 'move', x: 0, z: Number.POSITIVE_INFINITY })).toBeNull();
  });

  test('accepts every hotbar slot and nothing outside it', () => {
    for (let slot = 0; slot < HOTBAR_SLOTS; slot++) {
      expect(sanitizeCommand({ type: 'selectSlot', slot })).toEqual({ type: 'selectSlot', slot });
    }
    expect(sanitizeCommand({ type: 'selectSlot', slot: -1 })).toBeNull();
    expect(sanitizeCommand({ type: 'selectSlot', slot: HOTBAR_SLOTS })).toBeNull();
    expect(sanitizeCommand({ type: 'selectSlot', slot: 1.5 })).toBeNull();
  });

  test('accepts only a unit cycle step', () => {
    expect(sanitizeCommand({ type: 'cycleSlot', delta: -1 })).toEqual({
      type: 'cycleSlot',
      delta: -1,
    });
    expect(sanitizeCommand({ type: 'cycleSlot', delta: 2 } as unknown as Command)).toBeNull();
  });

  test('rejects an unknown command type', () => {
    expect(sanitizeCommand({ type: 'teleport' } as unknown as Command)).toBeNull();
  });

  test('validates farm ids and integer tile targets', () => {
    expect(
      sanitizeCommand({
        type: 'plantSeed',
        cropId: 'cabai',
        target: { area: 'bale', x: 8, z: -2 },
      }),
    ).toEqual({
      type: 'plantSeed',
      cropId: 'cabai',
      target: { area: 'bale', x: 8, z: -2 },
    });
    expect(
      sanitizeCommand({
        type: 'plantSeed',
        cropId: '../cabai',
        target: { area: 'bale', x: 8, z: -2 },
      }),
    ).toBeNull();
    expect(
      sanitizeCommand({
        type: 'harvest',
        target: { area: 'bale', x: 8.5, z: -2 },
      }),
    ).toBeNull();
    expect(
      sanitizeCommand({ type: 'harvest', target: undefined } as unknown as Command),
    ).toBeNull();
  });

  test('validates market transaction ids and bounded quantities', () => {
    expect(
      sanitizeCommand({
        type: 'buyItem',
        marketId: 'pasar_baledono',
        itemId: 'cabai_seed',
        quantity: 3,
      }),
    ).toEqual({
      type: 'buyItem',
      marketId: 'pasar_baledono',
      itemId: 'cabai_seed',
      quantity: 3,
    });
    expect(
      sanitizeCommand({
        type: 'sellItem',
        marketId: '../pasar',
        itemId: 'cabai',
        quantity: 1,
      }),
    ).toBeNull();
    expect(
      sanitizeCommand({
        type: 'sellItem',
        marketId: 'pasar_baledono',
        itemId: 'cabai',
        quantity: 0,
      }),
    ).toBeNull();
  });

  test('returns a copy, never the caller’s object', () => {
    const input: Command = { type: 'interact' };
    expect(sanitizeCommand(input)).not.toBe(input);
  });
});

describe('createContext', () => {
  test('carries the step’s commands, empty by default', () => {
    expect(createContext().commands).toEqual([]);
    const commands: Command[] = [{ type: 'interact' }];
    expect(createContext(1, commands).commands).toBe(commands);
  });
});
