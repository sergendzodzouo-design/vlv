import {
  Controller,
  Get,
  Inject,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Public } from "../auth/auth.context.js";
import { DatabaseService } from "../database/database.service.js";

@Public()
@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  @Get()
  live() {
    return { status: "ok", time: new Date().toISOString() };
  }

  @Get("db")
  async db() {
    try {
      await this.database.ping();
    } catch (error) {
      this.logger.error(
        `Base de données injoignable : ${error instanceof Error ? error.message : "erreur inconnue"}`,
      );
      throw new ServiceUnavailableException("Base de données indisponible.");
    }
    return { status: "ok", time: new Date().toISOString() };
  }
}
