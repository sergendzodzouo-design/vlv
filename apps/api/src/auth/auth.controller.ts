import { Controller, Get } from "@nestjs/common";
import { type AuthContext, CurrentAuth } from "./auth.context.js";

@Controller("me")
export class AuthController {
  /** Identité de l'utilisateur connecté. Le profil, les rôles et les organisations viendront au lot 6B. */
  @Get()
  me(@CurrentAuth() auth: AuthContext | undefined) {
    return { userId: auth?.userId, email: auth?.email, aal: auth?.aal };
  }
}
