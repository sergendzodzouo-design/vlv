import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { type JWTVerifyGetKey, SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { JWKS_RESOLVER } from "../src/auth/jwt-verifier.service.js";
import { ENV } from "../src/config/config.module.js";
import { parseEnv } from "../src/config/env.js";
import { DatabaseService } from "../src/database/database.service.js";

type SigningKey = Parameters<SignJWT["sign"]>[0];

const SUPABASE_URL = "https://testproject.supabase.co";
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const USER_ID = "7b2f9c1e-4d3a-4e8b-9a61-2f5d8c0e1a34";

type SignOptions = {
  issuer?: string;
  audience?: string;
  expiresAt?: number;
  key?: SigningKey;
  alg?: string;
};

describe("Authentification (e2e)", () => {
  let app: INestApplication;
  let privateKey: SigningKey;
  let resolver: JWTVerifyGetKey;
  const keys: JWTVerifyGetKey = (header, token) => resolver(header, token);
  const now = () => Math.floor(Date.now() / 1000);

  async function sign(claims: Record<string, unknown> = {}, options: SignOptions = {}) {
    return new SignJWT({ sub: USER_ID, email: "client@exemple.cg", ...claims })
      .setProtectedHeader({ alg: options.alg ?? "RS256", kid: "test-key" })
      .setIssuer(options.issuer ?? ISSUER)
      .setAudience(options.audience ?? "authenticated")
      .setIssuedAt(now() - 120)
      .setExpirationTime(options.expiresAt ?? now() + 300)
      .sign(options.key ?? privateKey);
  }

  const get = (path: string, token?: string) => {
    const call = request(app.getHttpServer()).get(path);
    return token ? call.set("Authorization", `Bearer ${token}`) : call;
  };

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    const jwk = { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "RS256", use: "sig" };
    const localKeys = createLocalJWKSet({ keys: [jwk] });
    resolver = localKeys;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(
        parseEnv({
          NODE_ENV: "test",
          DATABASE_URL: "postgresql://user:pw@localhost:5432/test",
          SUPABASE_URL,
        }),
      )
      .overrideProvider(DatabaseService)
      .useValue({ ping: vi.fn() })
      .overrideProvider(JWKS_RESOLVER)
      .useValue(keys)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    resolver = localKeys;
  });

  afterAll(async () => {
    await app.close();
  });

  it("accepte un jeton valide et renvoie l'identité", async () => {
    const token = await sign({ aal: "aal1" });
    const response = await get("/api/v1/me", token).expect(200);
    expect(response.body).toEqual({ userId: USER_ID, email: "client@exemple.cg", aal: "aal1" });
  });

  it("laisse les routes de santé publiques", async () => {
    await get("/api/v1/health").expect(200);
  });

  it("refuse une requête sans jeton", async () => {
    const response = await get("/api/v1/me").expect(401);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });

  it("refuse un en-tête d'autorisation qui n'est pas de type Bearer", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", "Basic dXNlcjpwYXNz")
      .expect(401);
  });

  it("refuse un jeton expiré", async () => {
    const token = await sign({}, { expiresAt: now() - 60 });
    await get("/api/v1/me", token).expect(401);
  });

  it("refuse un jeton émis par un autre émetteur", async () => {
    const token = await sign({}, { issuer: "https://autre.supabase.co/auth/v1" });
    await get("/api/v1/me", token).expect(401);
  });

  it("refuse un jeton destiné à un autre public", async () => {
    const token = await sign({}, { audience: "anon" });
    await get("/api/v1/me", token).expect(401);
  });

  it("refuse un jeton signé avec une autre clé", async () => {
    const other = await generateKeyPair("RS256");
    const token = await sign({}, { key: other.privateKey });
    await get("/api/v1/me", token).expect(401);
  });

  it("refuse un jeton signé en HS256", async () => {
    const secret = new TextEncoder().encode("un-secret-de-test-de-plus-de-32-caracteres");
    const token = await sign({}, { alg: "HS256", key: secret });
    await get("/api/v1/me", token).expect(401);
  });

  it("refuse un compte anonyme", async () => {
    const token = await sign({ is_anonymous: true });
    await get("/api/v1/me", token).expect(401);
  });

  it("refuse un identifiant utilisateur qui n'est pas un UUID", async () => {
    const token = await sign({ sub: "pas-un-uuid" });
    await get("/api/v1/me", token).expect(401);
  });

  it("ne renvoie jamais le jeton dans l'erreur", async () => {
    const token = await sign({}, { expiresAt: now() - 60 });
    const response = await get("/api/v1/me", token).expect(401);
    expect(JSON.stringify(response.body)).not.toContain(token);
  });

  it("répond 503 si les clés publiques sont injoignables", async () => {
    const previous = resolver;
    resolver = async () => {
      throw new TypeError("fetch failed");
    };
    try {
      const token = await sign();
      const response = await get("/api/v1/me", token).expect(503);
      expect(response.headers["content-type"]).toContain("application/problem+json");
    } finally {
      resolver = previous;
    }
  });
});
