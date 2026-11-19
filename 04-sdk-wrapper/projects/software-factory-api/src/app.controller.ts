import { Controller, Get, Header } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getSoftwareFactoryPage(): string {
    return readFileSync(join(__dirname, 'public', 'index.html'), 'utf-8');
  }

  @Get('factory')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getFactoryPage(): string {
    return this.getSoftwareFactoryPage();
  }

  @Get('health')
  getHealth() {
    return { status: 'ok', service: this.appService.getHello() };
  }
}
