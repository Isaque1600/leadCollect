import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import type { User } from "../db/schema";

export interface AuthedRequest extends Request {
  user: User;
}

/**
 * Guards routes behind the bearer token issued at sign-in. A missing, malformed,
 * expired, or unknown-user token is a 401.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("missing bearer token");
    }

    let sub: string;
    try {
      sub = this.auth.verifyToken(token).sub;
    } catch {
      throw new UnauthorizedException("invalid token");
    }

    const user = await this.auth.findById(sub);
    if (!user) {
      throw new UnauthorizedException("unknown user");
    }
    req.user = user;
    return true;
  }
}
