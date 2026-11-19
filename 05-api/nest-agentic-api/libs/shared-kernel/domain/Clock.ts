/**
 * Source of the current time for the domain. Rules that depend on time
 * (license validity, grace periods, `updatedAt`) ask the clock instead of
 * calling `new Date()`, so tests can pin or advance time and production has a
 * single source of truth: the server's clock.
 */
export interface Clock {
  now(): Date;
}
