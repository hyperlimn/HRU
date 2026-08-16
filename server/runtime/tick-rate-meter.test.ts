import { describe, expect, it } from 'vitest';
import { TickRateMeter } from './tick-rate-meter';

describe('TickRateMeter', () => {
  it('measures ticks advanced divided by elapsed wall-clock seconds', () => {
    const meter = new TickRateMeter(500);
    expect(meter.record(1_000, 10_000)).toBe(0);
    expect(meter.record(1_250, 10_050)).toBe(0);
    expect(meter.record(1_500, 10_100)).toBe(200);
    expect(meter.record(2_500, 10_350)).toBe(250);
  });

  it('resets the rolling window while paused', () => {
    const meter = new TickRateMeter(500);
    meter.record(0, 0); meter.record(500, 100);
    expect(meter.reset()).toBe(0);
    expect(meter.record(5_000, 100)).toBe(0);
  });
});
