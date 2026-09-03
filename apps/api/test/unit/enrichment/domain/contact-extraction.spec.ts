import { describe, expect, it } from "vitest";
import {
  extractContacts,
  pickPhone,
  EMAIL_PATTERN,
  PHONE_PATTERN,
  WHATSAPP_PATTERN,
} from "../../../../src/modules/enrichment/domain/contact-extraction";

/**
 * The three patterns are a straight port of `collector_maps.py` (ADR-0004), so
 * these cases are written against what the Python collector actually matched on
 * real Brazilian company sites — not against a tidier regex we might prefer.
 */
describe("EMAIL_PATTERN", () => {
  it("finds an address in the middle of markup", () => {
    expect(EMAIL_PATTERN.exec('<a href="mailto:contato@clinica.com.br">')?.[0]).toBe(
      "contato@clinica.com.br",
    );
  });

  it("accepts the punctuation a real local part carries", () => {
    expect(EMAIL_PATTERN.exec("dr.joao+agenda_1%teste-x@sub.clinica.com")?.[0]).toBe(
      "dr.joao+agenda_1%teste-x@sub.clinica.com",
    );
  });

  it("needs a two-letter TLD at least", () => {
    expect(EMAIL_PATTERN.test("alguem@host.c")).toBe(false);
  });
});

describe("WHATSAPP_PATTERN", () => {
  it("captures the digits of a wa.me link", () => {
    expect(WHATSAPP_PATTERN.exec('<a href="https://wa.me/5583999990000">')?.[1]).toBe(
      "5583999990000",
    );
  });

  it("captures the digits of an api.whatsapp.com link", () => {
    expect(
      WHATSAPP_PATTERN.exec("https://api.whatsapp.com/send?phone=5583988887777&text=oi")?.[1],
    ).toBe("5583988887777");
  });

  it("ignores a number that is too short to be a WhatsApp number", () => {
    expect(WHATSAPP_PATTERN.test("https://wa.me/123456789")).toBe(false);
  });

  it("ignores a phone number that is not behind a WhatsApp link", () => {
    expect(WHATSAPP_PATTERN.test("Fale conosco: 5583999990000")).toBe(false);
  });
});

describe("PHONE_PATTERN", () => {
  it("matches a landline written with parentheses and a dash", () => {
    expect(PHONE_PATTERN.exec("Ligue (83) 3421-0000 hoje")?.[0]).toBe("(83) 3421-0000");
  });

  it("matches a mobile with the country code and the ninth digit", () => {
    expect(PHONE_PATTERN.exec("+55 83 99999-0000")?.[0]).toBe("+55 83 99999-0000");
  });

  it("matches a number written with no separators at all", () => {
    expect(PHONE_PATTERN.exec("8334210000")?.[0]).toBe("8334210000");
  });
});

describe("extractContacts", () => {
  const html = `
    <html><body>
      <a href="mailto:contato@clinica.com.br">e-mail</a>
      <a href="https://wa.me/5583999990000">WhatsApp</a>
      <p>Telefone: (83) 3421-0000</p>
    </body></html>`;

  it("pulls email, WhatsApp and site phone out of a page", () => {
    expect(extractContacts(html)).toEqual({
      email: "contato@clinica.com.br",
      whatsapp: "5583999990000",
      // The digits inside the wa.me link satisfy the phone pattern too, and they
      // come first — exactly what the Python collector matched. Harmless: the
      // WhatsApp number outranks the site phone anyway (see `pickPhone`).
      sitePhone: "5583999990000",
    });
  });

  it("reads the phone written on a page that has no WhatsApp link", () => {
    expect(extractContacts("<p>Telefone: (83) 3421-0000</p>").sitePhone).toBe("(83) 3421-0000");
  });

  it("takes the first match of each, as the Python collector did", () => {
    const twoEmails = "primeiro@clinica.com.br e depois segundo@clinica.com.br";
    expect(extractContacts(twoEmails).email).toBe("primeiro@clinica.com.br");
  });

  it("drops an image file name that only looks like an email", () => {
    expect(extractContacts('<img src="logo@2x.PNG">').email).toBeNull();
  });

  it("reports nulls for a page with no contact details", () => {
    expect(extractContacts("<html><body>Bem-vindo</body></html>")).toEqual({
      email: null,
      whatsapp: null,
      sitePhone: null,
    });
  });
});

describe("pickPhone", () => {
  const contacts = {
    email: null,
    whatsapp: "5583999990000",
    sitePhone: "(83) 3421-0000",
  };

  it("prefers the site's WhatsApp over everything", () => {
    expect(pickPhone(contacts, "(83) 3000-0000")).toBe("5583999990000");
  });

  it("falls back to the phone Places returned when the site has no WhatsApp", () => {
    expect(pickPhone({ ...contacts, whatsapp: null }, "(83) 3000-0000")).toBe("(83) 3000-0000");
  });

  it("falls back to the phone found on the site when Places had none", () => {
    expect(pickPhone({ ...contacts, whatsapp: null }, null)).toBe("(83) 3421-0000");
  });

  it("is null when neither the site nor Places knows a number", () => {
    expect(pickPhone({ email: null, whatsapp: null, sitePhone: null }, null)).toBeNull();
  });
});
