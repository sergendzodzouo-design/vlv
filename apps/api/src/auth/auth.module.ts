import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { JwtVerifierService, jwksResolverProvider } from "./jwt-verifier.service.js";

@Module({
  controllers: [AuthController],
  providers: [jwksResolverProvider, JwtVerifierService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [JwtVerifierService],
})
export class AuthModule {}
