import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { Public } from '../../../../shared/auth/auth.guard';
import {
  TaskIntakeService,
  type IntakeMessage,
  type IntakeResult,
} from '../intake/task-intake.service';
import { renderManualApp } from './manual-app.page';

@Controller('factory')
export class IntakeController {
  private readonly logger = new Logger(IntakeController.name);

  constructor(private readonly intake: TaskIntakeService) {}

  /** La página es pública; sus llamadas a la API sí requieren sesión. */
  @Public()
  @Get('app')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  app(): string {
    return renderManualApp();
  }

  @Get('intake/defaults')
  async defaults() {
    return { owner: await this.intake.defaultOwner() };
  }

  @Post('intake')
  @HttpCode(HttpStatus.OK)
  async next(
    @Body() body: { messages?: IntakeMessage[] },
  ): Promise<IntakeResult> {
    try {
      return await this.intake.next(body?.messages ?? []);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'BadRequestException') {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Admisión falló: ${message}`);
      throw new BadGatewayException(
        'El asistente no pudo responder. Intenta de nuevo.',
      );
    }
  }
}
