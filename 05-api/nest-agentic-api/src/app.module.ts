import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { GlobalModule } from './global/global.module';
import { FactoryModule } from './modules/bounded/factory/factory.module';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter';
import { AuthController } from './shared/auth/auth.controller';
import { AuthGuard } from './shared/auth/auth.guard';

@Module({
  imports: [GlobalModule.register(), FactoryModule.register()],
  controllers: [AuthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
