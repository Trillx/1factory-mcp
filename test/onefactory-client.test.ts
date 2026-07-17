import { describe, expect, it, vi } from "vitest";

import type { OneFactoryConfig } from "../src/config.js";
import {
  OneFactoryApiError,
  OneFactoryClient,
} from "../src/onefactory-client.js";

const config: OneFactoryConfig = {
  apiKey: "super-secret-test-key",
  baseUrl: "https://www.1factory.co/api/v1",
  enableWrites: false,
  organizationId: "test-org",
  redactedFields: new Set(),
  requestTimeoutMs: 5_000,
};

describe("OneFactoryClient", () => {
  it("injects credentials and applies bounded search parameters", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([{ part_number: "P-100", rev: "A" }]), {
        headers: {
          "content-type": "application/json",
          "x-ratelimit-day-remaining": "999",
        },
        status: 200,
      }),
    );
    const client = new OneFactoryClient(config, fetchMock);

    const result = await client.searchPartMasters({
      page: 1,
      pageSize: 25,
      partNumber: "P-100",
      revision: "A",
    });

    expect(result.data).toHaveLength(1);
    expect(result.rateLimit.dayRemaining).toBe(999);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("page=1");
    expect(String(url)).toContain("page_size=25");
    expect(request?.headers).toMatchObject({
      "x-1factory-key": "super-secret-test-key",
      "x-1factory-org": "test-org",
    });
    expect(request?.redirect).toBe("error");
  });

  it("does not reflect upstream bodies or credentials in errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "FAC-2",
          message: "Invalid super-secret-test-key for test-org",
        }),
        { headers: { "content-type": "application/json" }, status: 401 },
      ),
    );
    const client = new OneFactoryClient(config, fetchMock);

    const request = client.searchPartMasters({});
    await expect(request).rejects.toBeInstanceOf(OneFactoryApiError);
    await expect(request).rejects.not.toThrow("super-secret-test-key");
    await expect(request).rejects.not.toThrow("test-org");
    await expect(request).rejects.toThrow("FAC-2");
  });

  it("rejects unexpected content types", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<html>not json</html>", {
        headers: { "content-type": "text/html" },
        status: 200,
      }),
    );
    const client = new OneFactoryClient(config, fetchMock);

    await expect(client.searchPartMasters({})).rejects.toThrow(
      "unexpected content type",
    );
  });

  it("rejects JSON that does not match the documented response schema", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([{ rev: "A", unexpected: true }]), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    const client = new OneFactoryClient(config, fetchMock);

    await expect(client.searchPartMasters({})).rejects.toThrow(
      "did not match the expected schema",
    );
  });

  it("strips fields that are not approved for search results", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            part_number: "P-300",
            rev: "C",
            comments: "sensitive internal note",
            cost: 42.5,
            future_api_field: "unexpected",
          },
        ]),
        { headers: { "content-type": "application/json" }, status: 200 },
      ),
    );
    const client = new OneFactoryClient(config, fetchMock);

    const result = await client.searchPartMasters({});

    expect(result.data).toEqual([{ part_number: "P-300", rev: "C" }]);
    expect(JSON.stringify(result.data)).not.toContain(
      "sensitive internal note",
    );
    expect(JSON.stringify(result.data)).not.toContain("future_api_field");
  });

  it("routes every read-only quality workflow to a bounded endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const path = new URL(String(url)).pathname;
      const record =
        path === "/api/v1/sup/7"
          ? { ID: 7, name: "Fictional Supplier", vendor_code: "FS-7" }
          : path.endsWith("/42")
            ? { ID: 42, part_number: "DEMO-42" }
            : [];
      return new Response(JSON.stringify(record), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    });
    const client = new OneFactoryClient(config, fetchMock);

    await client.listPlans("manufacturing", { page: 0, pageSize: 10 });
    await client.getPlan("receiving", 42);
    await client.listInspections("supplier", { page: 0, pageSize: 10 });
    await client.getInspection("customer", 42);
    await client.listFais("receiving", { page: 0, pageSize: 10 });
    await client.getFai("manufacturing", 42);
    await client.listSuppliers({ page: 0, pageSize: 10 });
    await client.getSupplier(7);
    await client.listQmsRecords("ncr", { page: 0, pageSize: 10 });

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/mfg/plans?page=0&page_size=10"),
        expect.stringContaining("/rec/plans/42"),
        expect.stringContaining("/sup/inspections?page=0&page_size=10"),
        expect.stringContaining("/cus/inspections/42"),
        expect.stringContaining("/rec/fais?page=0&page_size=10"),
        expect.stringContaining("/mfg/fais/42"),
        expect.stringContaining("/sup?page=0&page_size=10"),
        expect.stringContaining("/sup/7"),
        expect.stringContaining("/qms/ncrs?page=0&page_size=10"),
      ]),
    );
  });

  it("rejects pages outside the total-result window before calling upstream", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new OneFactoryClient(config, fetchMock);

    await expect(
      client.listPlans("manufacturing", { page: 10, pageSize: 100 }),
    ).rejects.toThrow("pagination limits");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("applies configured field redaction recursively", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            { ID: 1, part_number: "DEMO", root_cause: "private" },
          ]),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      );
    const client = new OneFactoryClient(
      { ...config, redactedFields: new Set(["root_cause"]) },
      fetchMock,
    );

    const result = await client.listQmsRecords("capa", {});
    expect(result.data).toEqual([{ ID: 1, part_number: "DEMO" }]);
  });
});
