import { afterEach, describe, expect, it, vi } from "vitest";
import { GooglePlacesMapsSource } from "../../../../src/modules/jobs/infra/google-places.maps-source";

const config = { apiKey: "test-places-key" };

function makeSource() {
  return new GooglePlacesMapsSource(config);
}

function stubFetch(body: unknown, init: { ok?: boolean; status?: number; text?: string } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => init.text ?? "",
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GooglePlacesMapsSource.search", () => {
  it("posts textQuery, pt-BR, and the field mask the Python collector used", async () => {
    const fetchMock = stubFetch({ places: [{ id: "abc", displayName: { text: "Clínica A" } }] });

    await makeSource().search("Clínicas odontológicas em Patos PB", 5);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Goog-Api-Key"]).toBe("test-places-key");
    expect(init.headers["X-Goog-FieldMask"]).toBe("places.id,places.displayName");
    expect(JSON.parse(init.body)).toEqual({
      textQuery: "Clínicas odontológicas em Patos PB",
      languageCode: "pt-BR",
      maxResultCount: 5,
    });
  });

  it("clamps maxResultCount to the 1..20 the Places API accepts", async () => {
    const fetchMock = stubFetch({ places: [] });
    const source = makeSource();

    await source.search("q", 500);
    await source.search("q", 0);

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).maxResultCount).toBe(20);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).maxResultCount).toBe(1);
  });

  it("maps places to hits and skips any entry with no place_id", async () => {
    stubFetch({
      places: [
        { id: "abc", displayName: { text: "Clínica A" } },
        { displayName: { text: "sem id" } },
        { id: "def" },
      ],
    });

    await expect(makeSource().search("q", 20)).resolves.toEqual([
      { placeId: "abc", name: "Clínica A" },
      { placeId: "def", name: "" },
    ]);
  });

  it("returns no hits when the response carries no places at all", async () => {
    stubFetch({});

    await expect(makeSource().search("q", 20)).resolves.toEqual([]);
  });
});

describe("GooglePlacesMapsSource.fetchDetails", () => {
  it("gets places/{place_id} with the details field mask", async () => {
    const fetchMock = stubFetch({ id: "abc", displayName: { text: "Clínica A" } });

    await makeSource().fetchDetails("abc");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://places.googleapis.com/v1/places/abc");
    expect(init.method).toBe("GET");
    expect(init.headers["X-Goog-FieldMask"]).toBe(
      "id,displayName,nationalPhoneNumber,websiteUri,googleMapsUri",
    );
  });

  it("maps the details and strips tracking noise from the website", async () => {
    stubFetch({
      id: "abc",
      displayName: { text: "Clínica Sorriso" },
      nationalPhoneNumber: "(83) 3421-0000",
      websiteUri: "https://sorriso.com.br/contato?utm_source=maps",
      googleMapsUri: "https://maps.google.com/?cid=abc",
    });

    await expect(makeSource().fetchDetails("abc")).resolves.toEqual({
      placeId: "abc",
      name: "Clínica Sorriso",
      phone: "(83) 3421-0000",
      website: "https://sorriso.com.br/contato",
      sourceUrl: "https://maps.google.com/?cid=abc",
    });
  });

  it("uses null, not an empty string, for the fields a place does not have", async () => {
    stubFetch({ id: "abc", displayName: { text: "Sem site" } });

    await expect(makeSource().fetchDetails("abc")).resolves.toMatchObject({
      phone: null,
      website: null,
      sourceUrl: null,
    });
  });

  it("throws with the API's own explanation, which lands on the failed Job row", async () => {
    stubFetch(undefined, { ok: false, status: 429, text: "RESOURCE_EXHAUSTED" });

    await expect(makeSource().fetchDetails("abc")).rejects.toThrow(
      "Places API responded 429: RESOURCE_EXHAUSTED",
    );
  });
});
