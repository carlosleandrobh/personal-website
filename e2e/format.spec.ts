import { expect, test } from '@playwright/test';
import { duration } from '../src/lib/format';

// Durations are written in whole words, because screen readers read "8 yrs 9 mo" as letters or as "moe".

test('durations use whole words, singular for one', () => {
  expect(duration('2026-07-01', '2026-07-15')).toBe('1 month');
  expect(duration('2026-07-01', '2026-11-30')).toBe('5 months');
  expect(duration('2025-01-01', '2025-12-31')).toBe('1 year');
  expect(duration('2024-01-01', '2025-02-28')).toBe('1 year 2 months');
  expect(duration('2020-01-01', '2022-01-31')).toBe('2 years 1 month');
  expect(duration('2017-12-01', '2026-08-31')).toBe('8 years 9 months');
});
