import { type ExecutionContext, SetMetadata, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";

/** Identité de l'utilisateur connecté, extraite d'un jeton Supabase vérifié. */
export interface AuthContext {
  userId: string;
  email: string | null;
  aal: "aal1" | "aal2" | null;
  sessionId: string | null;
}

export type AuthenticatedRequest = Request & { auth?: AuthContext };

export const IS_PUBLIC_KEY = "vlv:isPublic";

/** Marque une route comme publique. Toutes les autres exigent une connexion valide. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Donne accès à l'identité de l'utilisateur connecté dans un contrôleur. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().auth,
);
