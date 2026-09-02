import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { TokensService } from "../application/tokens.service";
import type { User } from "../domain/user";
import { USERS, type Users } from "../domain/users.port";

export interface AuthedRequest extends Request {
  user: User;
}

/**
 * Guards routes behind the bearer token issued at sign-in. A missing,
 * malformed, expired, or unknown-user token is a 401.
 *
 * Lives in the identity module's `api/` rather than `shared/` because it needs
 * this module's token service and `Users` port — putting it in `shared/` would
 * make `shared/` depend on a module (ADR-0008). Other modules import it by name.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokensService,
    @Inject(USERS) private readonly users: Users,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("missing bearer token");
    }

    let sub: string;
    try {
      sub = this.tokens.verify(token).sub;
    } catch {
      throw new UnauthorizedException("invalid token");
    }

    const user = await this.users.findById(sub);
    if (!user) {
      throw new UnauthorizedException("unknown user");
    }
    req.user = user;
    return true;
  }
}
