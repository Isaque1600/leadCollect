import type { AuthExchangeRequest } from "@olc/types";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/**
 * The body of `POST /auth/exchange`, checked by the global `ValidationPipe`.
 * An issued code is 43 base64url characters; the cap only keeps oversized
 * input away from the hash.
 */
export class ExchangeCodeDto implements AuthExchangeRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  code!: string;
}
