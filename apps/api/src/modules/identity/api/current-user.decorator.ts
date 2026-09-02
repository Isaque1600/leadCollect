import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { User } from "../domain/user";
import type { AuthedRequest } from "./jwt-auth.guard";

/**
 * Reads the user that `JwtAuthGuard` attached to the request, so handlers take
 * a `User` instead of poking at `req.user`. Nest's own `createParamDecorator`,
 * not a hand-rolled interceptor.
 *
 * Only meaningful on a route guarded by `JwtAuthGuard`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<AuthedRequest>().user,
);
