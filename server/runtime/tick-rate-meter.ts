export class TickRateMeter {
  private windowStartedAt?: number;
  private windowStartedTick?: number;
  private measuredRate = 0;

  constructor(private readonly windowMilliseconds = 500) {
    if (windowMilliseconds <= 0) throw new Error('Measurement window must be positive');
  }

  record(nowMilliseconds: number, currentTick: number): number {
    if (this.windowStartedAt === undefined || this.windowStartedTick === undefined) {
      this.windowStartedAt = nowMilliseconds;
      this.windowStartedTick = currentTick;
      return this.measuredRate;
    }
    const elapsed = nowMilliseconds - this.windowStartedAt;
    if (elapsed >= this.windowMilliseconds) {
      const ticksAdvanced = currentTick - this.windowStartedTick;
      this.measuredRate = elapsed > 0 ? ticksAdvanced / (elapsed / 1000) : 0;
      this.windowStartedAt = nowMilliseconds;
      this.windowStartedTick = currentTick;
    }
    return this.measuredRate;
  }

  reset(): number {
    this.windowStartedAt = undefined;
    this.windowStartedTick = undefined;
    this.measuredRate = 0;
    return this.measuredRate;
  }
}
