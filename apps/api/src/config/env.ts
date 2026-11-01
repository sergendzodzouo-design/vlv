import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z
      .string()
      .refine((value) => /^postgres(ql)?:\/\//.test(value), "doit commencer par postgresql://"),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(15).default(5),
    DATABASE_SSL: z.enum(["verify", "no-verify"]).default("verify"),
    SUPABASE_URL: z
      .string()
      .refine(
        (value) => /^https:\/\/[^\s/]+\/?$/.test(value),
        "doit être une adresse https://… sans chemin",
      )
      .transform((value) => value.replace(/\/+$/, "")),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.DATABASE_SSL === "no-verify") {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_SSL"],
        message: "no-verify est interdit en production",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Valide les variables d'environnement. En cas d'erreur, le message nomme les variables
 * fautives mais n'affiche JAMAIS leur valeur (elles peuvent contenir des secrets).
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map(
        (issue) => `- ${issue.path.map(String).join(".") || "(configuration)"} : ${issue.message}`,
      )
      .join("\n");
    throw new Error(`Configuration invalide :\n${problems}`);
  }
  return result.data;
}
