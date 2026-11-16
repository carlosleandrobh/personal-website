import { expect, test } from '@playwright/test';
import { count, duration } from '../src/lib/format';

// Durations are written in whole words, because screen readers read "8 yrs 9 mo" as letters or as "moe".

test('durations use whole words, singular for one', () => {
  expect(duration('2026-07-01', '2026-07-15')).toBe('1 month');
  expect(duration('2026-07-01', '2026-11-30')).toBe('5 months');
  expect(duration('2025-01-01', '2025-12-31')).toBe('1 year');
  expect(duration('2024-01-01', '2025-02-28')).toBe('1 year 2 months');
  expect(duration('2020-01-01', '2022-01-31')).toBe('2 years 1 month');
  expect(duration('2017-12-01', '2026-08-31')).toBe('8 years 9 months');
});

test('counts use the singular for one', () => {
  expect(count(0, 'experiment')).toBe('0 experiments');
  expect(count(1, 'experiment')).toBe('1 experiment');
  expect(count(4, 'experiment')).toBe('4 experiments');
});
