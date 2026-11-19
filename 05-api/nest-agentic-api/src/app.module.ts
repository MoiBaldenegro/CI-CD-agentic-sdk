import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GlobalModule } from './global/global.module';
import { FactoryModule } from './modules/bounded/factory/factory.module';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter';
import { ApiKeyGuard } from './shared/guards/api-key.guard';

@Module({
  imports: [GlobalModule.register(), FactoryModule.register()],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
