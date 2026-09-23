import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import type { AuthExchangeResponse, MeResponse } from "@olc/types";
import type { Request, Response } from "express";
import { appConfig } from "../../../shared/config/app.config";
import { IssueExchangeCodeUseCase } from "../application/issue-exchange-code.use-case";
import {
  InvalidExchangeCodeError,
  RedeemExchangeCodeUseCase,
} from "../application/redeem-exchange-code.use-case";
import { SignInWithGoogleUseCase } from "../application/sign-in-with-google.use-case";
import type { GoogleIdentity, User } from "../domain/user";
import { CurrentUser } from "./current-user.decorator";
import { ExchangeCodeDto } from "./exchange-code.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller()
export class AuthController {
  constructor(
    private readonly signInWithGoogle: SignInWithGoogleUseCase,
    private readonly issueExchangeCode: IssueExchangeCodeUseCase,
    private readonly redeemExchangeCode: RedeemExchangeCodeUseCase,
    @Inject(appConfig.KEY) private readonly config: ConfigType<typeof appConfig>,
  ) {}

  /** Kicks off the Google round trip. */
  @Get("auth/google")
  @UseGuards(AuthGuard("google"))
  login(): void {
    // AuthGuard redirects to Google; this body never runs.
  }

  /**
   * Google redirects back here. We sign the user in and bounce the browser to
   * the SPA's callback route with a short-lived, single-use exchange code, not
   * the JWT: the token never lands in the address bar or history (ticket 19).
   */
  @Get("auth/google/callback")
  @UseGuards(AuthGuard("google"))
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const identity = req.user as GoogleIdentity;
    const user = await this.signInWithGoogle.execute(identity);
    const code = await this.issueExchangeCode.execute(user);
    // `WEB_APP_URL` carries a trailing slash on the Render services.
    const webAppUrl = this.config.webAppUrl.replace(/\/+$/, "");
    res.redirect(`${webAppUrl}/auth/callback?code=${encodeURIComponent(code)}`);
  }

  /**
   * The SPA trades the exchange code for the JWT. 200 rather than Nest's
   * default 201 for a POST: nothing is created. Every refusal is the same bare
   * 401, so a caller cannot tell an unknown code from an expired or used one.
   */
  @Post("auth/exchange")
  @HttpCode(200)
  async exchange(@Body() body: ExchangeCodeDto): Promise<AuthExchangeResponse> {
    try {
      return { token: await this.redeemExchangeCode.execute(body.code) };
    } catch (error) {
      if (error instanceof InvalidExchangeCodeError) throw new UnauthorizedException();
      throw error;
    }
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User): MeResponse {
    const { id, email, name, monthlyQuotaUsed } = user;
    return { id, email, name, monthlyQuotaUsed };
  }
}
