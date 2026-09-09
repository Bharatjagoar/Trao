import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { generateKit } from "../pipeline/orchestrator.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input") args.input = argv[++i];
    else if (argv[i] === "--output") args.output = argv[++i];
  }
  if (!args.input || !args.output) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }
  return { input: args.input, output: args.output };
}

function classifyError(err) {
  const message = err instanceof Error ? err.message : String(err);
  if (/PRIVATE_ADDRESS_BLOCKED|URL_INVALID|PROTOCOL_NOT_ALLOWED/.test(message)) {
    return { code: "COMPANY_URL_INVALID", message };
  }
  if (/FETCH_FAILED|TIMEOUT|HTTP_\d+|DNS_RESOLUTION_FAILED/.test(message)) {
    return { code: "COMPANY_UNREACHABLE", message };
  }
  if (/RATE_LIMITED|quota/i.test(message)) {
    return { code: "LLM_RATE_LIMITED", message };
  }
  if (/invalid JSON/i.test(message)) {
    return { code: "LLM_INVALID_JSON", message };
  }
  if (/structural validation/i.test(message)) {
    return { code: "KIT_VALIDATION_FAILED", message };
  }
  if (/GEMINI_API_KEY/.test(message)) {
    return { code: "LLM_NOT_CONFIGURED", message };
  }
  return { code: "UNKNOWN_ERROR", message };
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));
  const raw = await readFile(input, "utf-8");
  const cases = JSON.parse(raw);

  const kits = [];

  for (const c of cases) {
    console.log(`[evaluate] running case ${c.id}...`);
    try {
      // allowPrivateNetworks: true — Appendix B fixtures are served from a
      // local address (e.g. http://localhost:8099/...). This is a trusted
      // offline evaluation harness, not the public-facing API, so the SSRF
      // guard that blocks private/loopback addresses in production is
      // relaxed here deliberately.
      const { kit, warnings } = await generateKit({
        jd: c.jd,
        companyUrl: c.company_url,
        days: c.days,
        allowPrivateNetworks: true,
      });
      if (warnings.length > 0) {
        console.log(`[evaluate] ${c.id} warnings: ${warnings.join(" | ")}`);
      }
      kits.push({ id: c.id, status: "ok", kit, error: null });
    } catch (err) {
      const error = classifyError(err);
      console.error(`[evaluate] ${c.id} FAILED: ${error.code} - ${error.message}`);
      kits.push({ id: c.id, status: "failed", kit: null, error });
    }
  }

  const result = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits,
  };

  await writeFile(output, JSON.stringify(result, null, 2), "utf-8");
  console.log(`[evaluate] wrote ${kits.length} result(s) to ${output}`);
}

main().catch((err) => {
  console.error("[evaluate] fatal error:", err);
  process.exit(1);
});
