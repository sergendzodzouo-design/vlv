import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { ENV } from "../src/config/config.module.js";
import { parseEnv } from "../src/config/env.js";
import { DatabaseService } from "../src/database/database.service.js";

describe("API VLV (e2e)", () => {
  let app: INestApplication;
  const database = { ping: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(
        parseEnv({ NODE_ENV: "test", DATABASE_URL: "postgresql://user:pw@localhost:5432/test" }),
      )
      .overrideProvider(DatabaseService)
      .useValue(database)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    database.ping.mockReset();
    database.ping.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/health répond ok, avec un identifiant de requête", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("GET /api/v1/health/db répond ok quand la base répond", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health/db").expect(200);
    expect(response.body.status).toBe("ok");
  });

  it("GET /api/v1/health/db répond 503 sans révéler le détail de l'erreur", async () => {
    database.ping.mockRejectedValue(new Error("password=secret"));
    const response = await request(app.getHttpServer()).get("/api/v1/health/db").expect(503);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body.status).toBe(503);
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
    expect(JSON.stringify(response.body)).not.toContain("secret");
  });

  it("une route inconnue renvoie une erreur 404 au format problem+json", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/inconnue").expect(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body.title).toBe("Not Found");
  });

  it("reprend un identifiant de requête valide et remplace un identifiant invalide", async () => {
    const valid = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("x-request-id", "abcd-1234-efgh");
    expect(valid.headers["x-request-id"]).toBe("abcd-1234-efgh");

    const invalid = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("x-request-id", "id invalide!");
    expect(invalid.headers["x-request-id"]).not.toBe("id invalide!");
    expect(invalid.headers["x-request-id"]).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });
});
