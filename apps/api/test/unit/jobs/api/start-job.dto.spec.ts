import { ValidationPipe, type ArgumentMetadata, BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { StartJobDto } from "../../../../src/modules/jobs/api/start-job.dto";

/** The same pipe configuration `main.ts` installs globally. */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const metadata: ArgumentMetadata = { type: "body", metatype: StartJobDto };

const validBody = {
  businessType: "Clínicas odontológicas",
  city: "Patos",
  state: "PB",
  maxResults: 20,
};

function validate(body: unknown): Promise<StartJobDto> {
  return pipe.transform(body, metadata) as Promise<StartJobDto>;
}

describe("StartJobDto", () => {
  it("accepts a well-formed body and hands the handler a DTO instance", async () => {
    const dto = await validate(validBody);

    expect(dto).toBeInstanceOf(StartJobDto);
    expect(dto).toEqual(validBody);
  });

  it("coerces a numeric string maxResults, so a form post is not a 400", async () => {
    const dto = await validate({ ...validBody, maxResults: "5" });

    expect(dto.maxResults).toBe(5);
  });

  it.each(["businessType", "city", "state"])("rejects a blank %s", async (field) => {
    await expect(validate({ ...validBody, [field]: "  " })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([0, 21, 2.5, "muitos"])("rejects maxResults %p", async (maxResults) => {
    await expect(validate({ ...validBody, maxResults })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects an undeclared field instead of quietly dropping it", async () => {
    await expect(validate({ ...validBody, sources: ["maps"] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
