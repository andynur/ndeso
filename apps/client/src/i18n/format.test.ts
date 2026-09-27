import { describe, expect, test } from 'bun:test';
import { createNumberFormats } from './format.ts';

describe('money (I18N §7)', () => {
  test('Indonesian uses a dot as the thousands separator, English a comma', () => {
    expect(createNumberFormats('id').money(12500)).toBe('Rp12.500');
    expect(createNumberFormats('en').money(12500)).toBe('Rp12,500');
  });

  test('rupiah has no decimals', () => {
    expect(createNumberFormats('id').money(800)).toBe('Rp800');
    expect(createNumberFormats('id').money(1234.56)).toBe('Rp1.235');
  });

  test('zero and negatives still format as currency', () => {
    expect(createNumberFormats('id').money(0)).toBe('Rp0');
    expect(createNumberFormats('id').money(-500)).toBe('-Rp500');
  });
});

describe('number', () => {
  test('follows the locale separators', () => {
    expect(createNumberFormats('id').number(1234.5)).toBe('1.234,5');
    expect(createNumberFormats('en').number(1234.5)).toBe('1,234.5');
  });
});

describe('clock', () => {
  test('is a zero-padded 24 h clock in both locales (I18N §7)', () => {
    expect(createNumberFormats('id').clock(6, 0)).toBe('06:00');
    expect(createNumberFormats('en').clock(6, 0)).toBe('06:00');
    expect(createNumberFormats('id').clock(23, 45)).toBe('23:45');
  });
});
