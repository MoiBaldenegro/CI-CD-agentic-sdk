import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Advisory lock key for running migrations. Advisory locks belong to one
 * database, so services with their own database never wait on each other.
 */
const MIGRATIONS_LOCK = 7145200311;

/**
 * Runs the pending migrations holding a Postgres advisory lock, so two
 * instances starting at once (a rolling deploy, several replicas) apply
 * them one after the other: the second waits, then finds nothing pending.
 * Without it both would try the same migration and one would crash.
 */
export async function runMigrationsLocked(
  dataSource: DataSource,
  logger = new Logger('Migrations'),
): Promise<void> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    await runner.query('SELECT pg_advisory_lock($1)', [MIGRATIONS_LOCK]);
    const applied = await dataSource.runMigrations();
    for (const migration of applied) {
      logger.log(`Applied ${migration.name}`);
    }
  } finally {
    await runner
      .query('SELECT pg_advisory_unlock($1)', [MIGRATIONS_LOCK])
      .catch(() => undefined);
    await runner.release();
  }
}
