import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import pg from "pg";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: pg.Pool;

  constructor(@Inject(ENV) env: Env) {
    this.pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      ssl: env.DATABASE_SSL === "verify" ? true : { rejectUnauthorized: false },
    });
    // Sans ce gestionnaire, une erreur sur une connexion inactive ferait tomber l'application.
    this.pool.on("error", (error) => {
      this.logger.error(`Erreur sur une connexion inactive : ${error.message}`);
    });
  }

  query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) {
    return this.pool.query<T>(text, params);
  }

  async withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await work(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<void> {
    await this.pool.query("select 1");
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
