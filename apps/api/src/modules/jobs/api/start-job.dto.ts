import { ApiProperty } from "@nestjs/swagger";
import type { StartJobRequest } from "@olc/types";
import { Transform, Type } from "class-transformer";
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

/** `places:searchText` refuses a `maxResultCount` above this. */
const PLACES_MAX_RESULTS = 20;

/**
 * Trims before validating, so `"   "` is caught by `@MinLength(1)`. On its own,
 * that decorator only rejects the empty string, and a whitespace-only city
 * would otherwise compose a nonsense query.
 */
const Trimmed = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value));

/**
 * The not-blank rule is `@MinLength(1, NOT_BLANK)` rather than `@IsNotEmpty()`
 * because the `@nestjs/swagger` CLI plugin reads `@MinLength` into the schema
 * as `minLength: 1` and does not read `@IsNotEmpty`. The plugin matches
 * decorators by name, so this must stay a direct `@MinLength` call, not a
 * wrapper. The message is `@IsNotEmpty`'s, because the SPA shows it.
 */
const NOT_BLANK = { message: "$property should not be empty" };

/**
 * The body of `POST /jobs`, checked by the global `ValidationPipe` before the
 * controller sees it (Nest's own pipe, not a hand-rolled check). `whitelist`
 * strips anything not declared here, so an unknown field cannot reach `params`.
 *
 * `implements StartJobRequest` keeps the class honest against the contract the
 * SPA compiles against in `@olc/types`.
 *
 * With the plugin's `introspectComments` on, each property's doc comment is its
 * description in the OpenAPI document, so those comments are written for API
 * callers. Notes for maintainers use `//`.
 */
export class StartJobDto implements StartJobRequest {
  /**
   * The kind of business to search for.
   * @example "Clínicas odontológicas"
   */
  @Trimmed()
  @IsString()
  @MinLength(1, NOT_BLANK)
  @MaxLength(120)
  businessType!: string;

  /**
   * The city to search in.
   * @example "Patos"
   */
  @Trimmed()
  @IsString()
  @MinLength(1, NOT_BLANK)
  @MaxLength(120)
  city!: string;

  /**
   * Brazilian state, usually the two-letter UF.
   * @example "PB"
   */
  @Trimmed()
  @IsString()
  @MinLength(1, NOT_BLANK)
  @MaxLength(40)
  state!: string;

  /**
   * How many results to ask each Source for. The Places API caps this at 20.
   * @example 20
   */
  // `@Type` makes the pipe's `transform` coerce `"20"` to `20`; without it a
  // JSON string would fail `@IsInt` even though the intent is unambiguous.
  // The plugin cannot map `@IsInt` to a schema type, so `@ApiProperty` says
  // `integer`. The plugin still adds the `minimum`/`maximum` from `@Min`/`@Max`.
  @ApiProperty({ type: "integer" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PLACES_MAX_RESULTS)
  maxResults!: number;
}
