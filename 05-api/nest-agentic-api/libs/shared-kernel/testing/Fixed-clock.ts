import { Clock } from '../domain/Clock';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Test clock: returns the time it was given until it is moved explicitly.
 * Not for production; use the service's system clock adapter there.
 */
export class FixedClock implements Clock {
  private current: Date;

  constructor(start: Date | string = '2026-01-01T00:00:00.000Z') {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(time: Date | string): void {
    this.current = new Date(time);
  }

  advanceDays(days: number): void {
    this.current = new Date(this.current.getTime() + days * DAY_MS);
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
