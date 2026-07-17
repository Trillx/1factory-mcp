import { describe, expect, it, vi } from "vitest";

import type { OneFactoryConfig } from "../src/config.js";
import {
  OneFactoryApiError,
  OneFactoryClient
} from "../src/onefactory-client.js";

const config: OneFactoryConfig = {
  apiKey: "super-secret-test-key",
  baseUrl: "https://www.1factory.co/api/v1",
  enableWrites: false,
  organizationId: "test-org",
  requestTimeoutMs: 5_000
};

describe("OneFactoryClient", () => {
  it("injects credentials and applies bounded search parameters", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([{ part_number: "P-100", rev: "A" }]), {
        headers: {
          "content-type": "application/json",
          "x-ratelimit-day-remaining": "999"
        },
        status: 200
      })
    );
    const client = new OneFactoryClient(config, fetchMock);

    const result = await client.searchPartMasters({
      page: 1,
      pageSize: 25,
      partNumber: "P-100",
      revision: "A"
    });

    expect(result.data).toHaveLength(1);
    expect(result.rateLimit.dayRemaining).toBe(999);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("page=1");
    expect(String(url)).toContain("page_size=25");
    expect(request?.headers).toMatchObject({
      "x-1factory-key": "super-secret-test-key",
      "x-1factory-org": "test-org"
    });
    expect(request?.redirect).toBe("error");
  });

  it("does not reflect upstream bodies or credentials in errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "FAC-2",
          message: "Invalid super-secret-test-key for test-org"
        }),
        { headers: { "content-type": "application/json" }, status: 401 }
      )
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
        status: 200
      })
    );
    const client = new OneFactoryClient(config, fetchMock);

    await expect(client.searchPartMasters({})).rejects.toThrow(
      "unexpected content type"
    );
  });
});
