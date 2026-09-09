import dns from "node:dns/promises";
import net from "node:net";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("fe80")) return true; // link-local
  return false;
}

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return false;
}

/**
 * Validates a company/source URL before it is fetched. Rejects non-http(s)
 * schemes always, and resolves the hostname to reject requests aimed at
 * private/loopback networks (SSRF) unless explicitly allowed (batch CLI
 * against local fixture servers).
 *
 * @param {string} input
 * @param {{ allowPrivateNetworks?: boolean }} [options]
 */
export async function validateExternalUrl(input, options = {}) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "URL_INVALID" };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "PROTOCOL_NOT_ALLOWED" };
  }

  const hostname = url.hostname;
  const isLocalHostname = hostname === "localhost" || hostname === "0.0.0.0";

  if (options.allowPrivateNetworks) {
    return { ok: true, url };
  }

  if (isLocalHostname) {
    return { ok: false, reason: "PRIVATE_ADDRESS_BLOCKED" };
  }

  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      return { ok: false, reason: "PRIVATE_ADDRESS_BLOCKED" };
    }
    return { ok: true, url };
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (records.some((r) => isPrivateAddress(r.address))) {
      return { ok: false, reason: "PRIVATE_ADDRESS_BLOCKED" };
    }
  } catch {
    return { ok: false, reason: "DNS_RESOLUTION_FAILED" };
  }

  return { ok: true, url };
}
