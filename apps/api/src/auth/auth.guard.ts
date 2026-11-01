import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type AuthenticatedRequest, IS_PUBLIC_KEY } from "./auth.context.js";
import { JwtVerifierService } from "./jwt-verifier.service.js";

/** Garde globale : toute route exige une connexion valide, sauf celles marquées @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtVerifierService) private readonly verifier: JwtVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header("authorization");
    const token = header ? /^Bearer\s+([A-Za-z0-9._-]+)$/i.exec(header)?.[1] : undefined;
    if (!token) throw new UnauthorizedException("Connexion requise.");

    request.auth = await this.verifier.verify(token);
    return true;
  }
}
