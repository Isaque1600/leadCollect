import { Controller, Get, Inject, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiBearerAuth,
  ApiFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { MeResponse } from "@olc/types";
import type { Request, Response } from "express";
import { appConfig } from "../../../shared/config/app.config";
import { SignInWithGoogleUseCase } from "../application/sign-in-with-google.use-case";
import { TokensService } from "../application/tokens.service";
import type { GoogleIdentity, User } from "../domain/user";
import { CurrentUser } from "./current-user.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { MeResponseDto } from "./me-response.dto";

/**
 * With the `@nestjs/swagger` plugin's `introspectComments` on, a route's doc
 * comment becomes its operation in the OpenAPI document: the summary, then
 * `@remarks` as the description. Those comments are written for API callers;
 * notes for maintainers go in `//` comments after them.
 */
@ApiTags("auth")
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
  @ApiFoundResponse({ description: "Redirects the browser to Google's consent screen." })
  login(): void {
    // AuthGuard redirects to Google; this body never runs.
  }

  /**
   * Google redirects back here after consent.
   *
   * @remarks Signs the user in, issues a JWT, and redirects the browser to the
   * SPA with the token in the URL fragment, which keeps it out of server logs
   * and the Referer header.
   */
  @Get("auth/google/callback")
  @UseGuards(AuthGuard("google"))
  @ApiFoundResponse({ description: "Redirects to the SPA with the JWT in the URL fragment." })
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const identity = req.user as GoogleIdentity;
    const user = await this.signInWithGoogle.execute(identity);
    const token = this.tokens.issue(user);
    res.redirect(`${this.config.webAppUrl}/#token=${encodeURIComponent(token)}`);
  }

  /** The signed-in user, with this month's Quota use. */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: "Missing, invalid or expired token." })
  me(@CurrentUser() user: User): MeResponse {
    const { id, email, name, monthlyQuotaUsed } = user;
    return { id, email, name, monthlyQuotaUsed };
  }
}
