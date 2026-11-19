import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the Software Factory HTML page', () => {
      const html = appController.getSoftwareFactoryPage();
      expect(html).toContain('Software Factory 2026');
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('should expose a health endpoint', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        service: 'Hello World!',
      });
    });
  });
});
