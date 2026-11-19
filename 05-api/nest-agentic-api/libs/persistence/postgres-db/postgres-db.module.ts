import { TypeOrmModule } from '@nestjs/typeorm';
import { DynamicModule, Module, Type } from '@nestjs/common';
import { DataSource, DataSourceOptions, EntitySchema } from 'typeorm';
import { PostgresDbConfig } from './config/postres-db.config';
import { SchemaDriftCheck } from './schema-drift.check';
import { runMigrationsLocked } from './locked-migrations';

type EntityClass = Type<unknown> | EntitySchema;

export interface PostgresDbConfigOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionString?: string;
  entities?: EntityClass[];
  /**
   * Let TypeORM change the tables to match the entities on startup. Off by
   * default: it can drop columns with data. Services manage their schema
   * with `migrations`; only a service without them yet opts in.
   */
  synchronize?: boolean;
  /** Migration classes, imported explicitly (webpack bundles the service). */
  migrations?: Type<unknown>[];
  /** Run pending migrations on startup. */
  migrationsRun?: boolean;
  /**
   * Warn on startup if the schema and the entities differ. For services
   * whose migrations are generated from the entities (tenancy); not for
   * hand-written ones that add constraints the entities do not declare
   * (IAM), where the "difference" is extra protection.
   */
  checkSchemaDrift?: boolean;
}

@Module({})
export class PostgresDbModule {
  static register(options: PostgresDbConfigOptions): DynamicModule {
    const db_config = PostgresDbConfig.getConfig(options);
    return {
      module: PostgresDbModule,
      imports: [
        TypeOrmModule.forRootAsync({
          // TypeORM's own migrationsRun has no lock: ours runs them under
          // one, before anything else uses the connection.
          useFactory: () => ({ ...db_config, migrationsRun: false }),
          dataSourceFactory: async (typeOrmOptions) => {
            const dataSource = await new DataSource(
              typeOrmOptions as DataSourceOptions,
            ).initialize();
            if (db_config.migrationsRun) await runMigrationsLocked(dataSource);
            return dataSource;
          },
        }),
      ],
      providers: options.checkSchemaDrift ? [SchemaDriftCheck] : [],
      exports: [],
    };
  }
}
