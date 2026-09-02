import type { StartJobRequest } from "@olc/types";
import { Transform, Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from "class-validator";

/** `places:searchText` refuses a `maxResultCount` above this. */
const PLACES_MAX_RESULTS = 20;

/**
 * Trims before validating, so `"   "` is caught by `@IsNotEmpty` — on its own
 * that decorator only rejects the empty string, and a whitespace-only city
 * would otherwise compose a nonsense query.
 */
const Trimmed = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value));

/**
 * The body of `POST /jobs`, checked by the global `ValidationPipe` before the
 * controller sees it (Nest's own pipe, not a hand-rolled check). `whitelist`
 * strips anything not declared here, so an unknown field cannot reach `params`.
 *
 * `implements StartJobRequest` keeps the class honest against the contract the
 * SPA compiles against in `@olc/types`.
 */
export class StartJobDto implements StartJobRequest {
  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  businessType!: string;

  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @Trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  state!: string;

  /**
   * `@Type` makes the pipe's `transform` coerce `"20"` to `20`; without it a
   * JSON string would fail `@IsInt` even though the intent is unambiguous.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PLACES_MAX_RESULTS)
  maxResults!: number;
}
