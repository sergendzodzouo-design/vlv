import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { type JWTPayload, type JWTVerifyGetKey, createRemoteJWKSet, errors, jwtVerify } from "jose";
import { z } from "zod";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import type { AuthContext } from "./auth.context.js";

export const JWKS_RESOLVER = Symbol("JWKS_RESOLVER");

/** Clés publiques du projet Supabase, récupérées à l'adresse /auth/v1/.well-known/jwks.json. */
export const jwksResolverProvider = {
  provide: JWKS_RESOLVER,
  inject: [ENV],
  useFactory: (env: Env): JWTVerifyGetKey =>
    createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)),
};

const claimsSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().optional(),
  aal: z.enum(["aal1", "aal2"]).optional(),
  session_id: z.string().optional(),
  is_anonymous: z.boolean().optional(),
});

@Injectable()
export class JwtVerifierService {
  private readonly logger = new Logger(JwtVerifierService.name);
  private readonly issuer: string;

  constructor(
    @Inject(ENV) env: Env,
    @Inject(JWKS_RESOLVER) private readonly keys: JWTVerifyGetKey,
  ) {
    this.issuer = `${env.SUPABASE_URL}/auth/v1`;
  }

  /** Vérifie signature, émetteur, destinataire et expiration. Ne journalise jamais le jeton. */
  async verify(token: string): Promise<AuthContext> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.keys, {
        issuer: this.issuer,
        audience: "authenticated",
        algorithms: ["RS256", "ES256"],
      }));
    } catch (error) {
      const isTokenProblem =
        error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout);
      this.logger.warn(`Jeton refusé (${error instanceof Error ? error.name : "erreur inconnue"})`);
      if (isTokenProblem) throw new UnauthorizedException("Jeton invalide ou expiré.");
      // Clés publiques injoignables : ce n'est pas la faute de l'utilisateur.
      throw new ServiceUnavailableException("Service d'authentification indisponible.");
    }

    const claims = claimsSchema.safeParse(payload);
    if (!claims.success || claims.data.is_anonymous === true) {
      this.logger.warn("Jeton refusé (contenu inattendu ou compte anonyme)");
      throw new UnauthorizedException("Jeton invalide ou expiré.");
    }

    return {
      userId: claims.data.sub,
      email: claims.data.email ?? null,
      aal: claims.data.aal ?? null,
      sessionId: claims.data.session_id ?? null,
    };
  }
}
