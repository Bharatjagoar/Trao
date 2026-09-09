import { describe, expect, it } from "vitest";
import { validateExternalUrl } from "../src/security/urlValidation.js";

describe("validateExternalUrl", () => {
  it("rejects an unparseable URL", async () => {
    const result = await validateExternalUrl("not a url");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("URL_INVALID");
  });

  it("rejects non-http(s) protocols", async () => {
    const result = await validateExternalUrl("ftp://example.com/file");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("PROTOCOL_NOT_ALLOWED");
  });

  it("rejects loopback IP literals by default", async () => {
    const result = await validateExternalUrl("http://127.0.0.1:8080/");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("PRIVATE_ADDRESS_BLOCKED");
  });

  it("rejects private-range IP literals by default", async () => {
    const result = await validateExternalUrl("http://192.168.1.10/");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("PRIVATE_ADDRESS_BLOCKED");
  });

  it("rejects the localhost hostname by default", async () => {
    const result = await validateExternalUrl("http://localhost:8099/acme/");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("PRIVATE_ADDRESS_BLOCKED");
  });

  it("allows localhost when allowPrivateNetworks is set (batch CLI mode)", async () => {
    const result = await validateExternalUrl("http://localhost:8099/acme/", {
      allowPrivateNetworks: true,
    });
    expect(result.ok).toBe(true);
  });

  it("allows a public IP literal", async () => {
    const result = await validateExternalUrl("http://8.8.8.8/");
    expect(result.ok).toBe(true);
  });
});
