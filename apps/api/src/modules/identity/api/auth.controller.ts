import { Controller, Get, Inject, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import type { MeResponse } from "@olc/types";
import type { Request, Response } from "express";
import { appConfig } from "../../../shared/config/app.config";
import { SignInWithGoogleUseCase } from "../application/sign-in-with-google.use-case";
import { TokensService } from "../application/tokens.service";
import type { GoogleIdentity, User } from "../domain/user";
import { CurrentUser } from "./current-user.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller()
export class AuthController {
  constructor(
    private readonly signInWithGoogle: SignInWithGoogleUseCase,
    private readonly tokens: TokensService,
    @Inject(appConfig.KEY) private readonly config: ConfigType<typeof appConfig>,
  ) {}

  /** Kicks off the Google round trip. */
  @Get("auth/google")
  @UseGuards(AuthGuard("google"))
  login(): void {
    // AuthGuard redirects to Google; this body never runs.
  }

  /**
   * Google redirects back here. We sign the user in, mint a JWT, and bounce the
   * browser to the SPA with the token in the URL fragment (kept out of logs and
   * the Referer header).
   */
  @Get("auth/google/callback")
  @UseGuards(AuthGuard("google"))
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const identity = req.user as GoogleIdentity;
    const user = await this.signInWithGoogle.execute(identity);
    const token = this.tokens.issue(user);
    res.redirect(`${this.config.webAppUrl}/#token=${encodeURIComponent(token)}`);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User): MeResponse {
    const { id, email, name, monthlyQuotaUsed } = user;
    return { id, email, name, monthlyQuotaUsed };
  }
}
