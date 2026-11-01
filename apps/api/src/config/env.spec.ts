import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

const validUrl = "postgresql://user:pw@localhost:5432/vlv";

describe("parseEnv", () => {
  it("applique les valeurs par défaut", () => {
    const env = parseEnv({ DATABASE_URL: validUrl });
    expect(env).toMatchObject({
      NODE_ENV: "development",
      PORT: 3001,
      DATABASE_POOL_MAX: 5,
      DATABASE_SSL: "verify",
    });
  });

  it("convertit PORT en nombre", () => {
    expect(parseEnv({ DATABASE_URL: validUrl, PORT: "4000" }).PORT).toBe(4000);
  });

  it("refuse l'absence de DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("refuse un PORT hors plage", () => {
    expect(() => parseEnv({ DATABASE_URL: validUrl, PORT: "70000" })).toThrow(/PORT/);
  });

  it("refuse no-verify en production", () => {
    expect(() =>
      parseEnv({ NODE_ENV: "production", DATABASE_URL: validUrl, DATABASE_SSL: "no-verify" }),
    ).toThrow(/DATABASE_SSL/);
  });

  it("n'affiche jamais la valeur d'une variable invalide", () => {
    let message = "";
    try {
      parseEnv({ DATABASE_URL: "mysql://admin:motdepasse-secret@host/db" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("DATABASE_URL");
    expect(message).not.toContain("motdepasse-secret");
  });
});
