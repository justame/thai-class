import { describe, it, expect } from 'vitest';
import { addDays, compareDates, toDateString } from '../src/dates.js';

describe('addDays', () => {
  it('should add days within a month', () => {
    expect(addDays('2026-06-09', 7)).toBe('2026-06-16');
  });

  it('should roll over a month boundary', () => {
    expect(addDays('2026-06-29', 3)).toBe('2026-07-02');
  });

  it('should roll over a year boundary', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('compareDates', () => {
  it('should return negative when first date is earlier', () => {
    expect(compareDates('2026-06-01', '2026-06-09')).toBeLessThan(0);
  });

  it('should return zero for the same day', () => {
    expect(compareDates('2026-06-09', '2026-06-09')).toBe(0);
  });
});

describe('toDateString', () => {
  it('should format a Date as YYYY-MM-DD', () => {
    expect(toDateString(new Date('2026-06-09T15:30:00Z'))).toBe('2026-06-09');
  });
});
