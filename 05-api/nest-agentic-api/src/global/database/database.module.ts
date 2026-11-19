import { DynamicModule, Module } from '@nestjs/common';
import { PostgresDbModule } from 'lib/persistence';
import { TaskOrmEntity } from '../../modules/bounded/factory/infrastructure/persistence/task.orm-entity';

@Module({})
export class DatabaseModule {
  static register(): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        PostgresDbModule.register({
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          user: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          database: process.env.DB_NAME ?? 'agentic_factory',
          synchronize: (process.env.DB_SYNCHRONIZE ?? 'true') === 'true',
          entities: [TaskOrmEntity],
        }),
      ],
    };
  }
}
