import { Module } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { jwtConfig } from "../../shared/config/jwt.config";
import { AuthController } from "./api/auth.controller";
import { GoogleStrategy } from "./api/google.strategy";
import { JwtAuthGuard } from "./api/jwt-auth.guard";
import { SignInWithGoogleUseCase } from "./application/sign-in-with-google.use-case";
import { TokensService } from "./application/tokens.service";
import { USERS } from "./domain/users.port";
import { DrizzleUsersRepository } from "./infra/drizzle-users.repository";

/**
 * Who the signed-in user is: Google sign-in, the `users` table, and the bearer
 * token every other module's routes are guarded by.
 *
 * `exports` is the module's public surface (ADR-0008) — later modules take
 * `JwtAuthGuard` to protect routes and the `USERS` port to look users up; the
 * Drizzle adapter and the controller stay private.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [jwtConfig.KEY],
      useFactory: (config: ConfigType<typeof jwtConfig>) => ({
        secret: config.secret,
        signOptions: { expiresIn: config.expiresIn },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    SignInWithGoogleUseCase,
    TokensService,
    GoogleStrategy,
    JwtAuthGuard,
    { provide: USERS, useClass: DrizzleUsersRepository },
  ],
  exports: [TokensService, JwtAuthGuard, USERS],
})
export class IdentityModule {}
