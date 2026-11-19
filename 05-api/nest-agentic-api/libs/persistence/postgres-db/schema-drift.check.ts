import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { safeErrorLog } from '../../logging/safe-error';

/** Statements shown in the warning; the rest are only counted. */
const SHOWN = 5;

/**
 * After the migrations ran, compares the database with the entities and
 * warns if they differ (a migration is missing, or someone changed the
 * schema by hand). It changes nothing. The warning shows schema statements
 * (DDL) only, never data.
 */
@Injectable()
export class SchemaDriftCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaDriftCheck.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const pending = await findSchemaDrift(this.dataSource);
      if (pending.length === 0) return;
      this.logger.warn(
        `The database schema differs from the entities (${pending.length} statements to align them); add a migration. First ones:\n${pending
          .slice(0, SHOWN)
          .join(';\n')}`,
      );
    } catch (error) {
      this.logger.warn(`Schema check failed: ${safeErrorLog(error)}`);
    }
  }
}

/** The statements `synchronize` would run; empty when schema and entities match. */
export async function findSchemaDrift(
  dataSource: DataSource,
): Promise<string[]> {
  const sql = await dataSource.driver.createSchemaBuilder().log();
  return sql.upQueries.map((query) => query.query.trim());
}
