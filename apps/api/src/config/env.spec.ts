import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

const validUrl = "postgresql://user:pw@localhost:5432/vlv";
const base = { DATABASE_URL: validUrl, SUPABASE_URL: "https://abcdefgh.supabase.co" };

describe("parseEnv", () => {
  it("applique les valeurs par défaut", () => {
    expect(parseEnv(base)).toMatchObject({
      NODE_ENV: "development",
      PORT: 3001,
      DATABASE_POOL_MAX: 5,
      DATABASE_SSL: "verify",
    });
  });

  it("convertit PORT en nombre", () => {
    expect(parseEnv({ ...base, PORT: "4000" }).PORT).toBe(4000);
  });

  it("refuse l'absence de DATABASE_URL", () => {
    expect(() => parseEnv({ SUPABASE_URL: base.SUPABASE_URL })).toThrow(/DATABASE_URL/);
  });

  it("refuse l'absence de SUPABASE_URL", () => {
    expect(() => parseEnv({ DATABASE_URL: validUrl })).toThrow(/SUPABASE_URL/);
  });

  it("refuse une SUPABASE_URL en http", () => {
    expect(() => parseEnv({ ...base, SUPABASE_URL: "http://abcdefgh.supabase.co" })).toThrow(
      /SUPABASE_URL/,
    );
  });

  it("retire la barre oblique finale de SUPABASE_URL", () => {
    expect(parseEnv({ ...base, SUPABASE_URL: "https://abcdefgh.supabase.co/" }).SUPABASE_URL).toBe(
      "https://abcdefgh.supabase.co",
    );
  });

  it("refuse un PORT hors plage", () => {
    expect(() => parseEnv({ ...base, PORT: "70000" })).toThrow(/PORT/);
  });

  it("refuse no-verify en production", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production", DATABASE_SSL: "no-verify" })).toThrow(
      /DATABASE_SSL/,
    );
  });

  it("n'affiche jamais la valeur d'une variable invalide", () => {
    let message = "";
    try {
      parseEnv({ ...base, DATABASE_URL: "mysql://admin:motdepasse-secret@host/db" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("DATABASE_URL");
    expect(message).not.toContain("motdepasse-secret");
  });
});
