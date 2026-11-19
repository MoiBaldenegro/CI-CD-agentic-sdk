import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GlobalModule } from './global/global.module';
import { FactoryModule } from './modules/bounded/factory/factory.module';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter';

@Module({
  imports: [GlobalModule.register(), FactoryModule.register()],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
  ],
})
export class AppModule {}
