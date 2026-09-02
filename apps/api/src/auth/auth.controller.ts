import { Controller, Get, Req, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { MeResponse } from "@olc/types";
import type { Request, Response } from "express";
import { AuthService, type GoogleIdentity } from "./auth.service";
import { AuthedRequest, JwtAuthGuard } from "./jwt-auth.guard";

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Kicks off the Google round trip. */
  @Get("auth/google")
  @UseGuards(AuthGuard("google"))
  login(): void {
    // AuthGuard redirects to Google; this body never runs.
  }

  /**
   * Google redirects back here. We upsert the user, mint a JWT, and bounce the
   * browser to the SPA with the token in the URL fragment (kept out of logs and
   * the Referer header).
   */
  @Get("auth/google/callback")
  @UseGuards(AuthGuard("google"))
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const identity = req.user as GoogleIdentity;
    const user = await this.auth.upsertGoogleUser(identity);
    const token = this.auth.issueToken(user);
    const webAppUrl = process.env.WEB_APP_URL ?? "http://localhost:5173";
    res.redirect(`${webAppUrl}/#token=${encodeURIComponent(token)}`);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest): MeResponse {
    const { id, email, name, monthlyQuotaUsed } = req.user;
    return { id, email, name, monthlyQuotaUsed };
  }
}
