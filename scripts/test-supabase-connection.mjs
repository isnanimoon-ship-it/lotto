import fs from "node:fs";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`${path} not found`);
  }

  const values = {};
  for (const rawLine of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

const env = loadEnvFile(".env.local");
const supabaseUrl = env.SUPABASE_URL;
const serverKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("SUPABASE_URL is empty");
if (!serverKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is empty");

const parsedUrl = new URL(supabaseUrl);
if (parsedUrl.protocol !== "https:") {
  throw new Error("SUPABASE_URL must use https");
}

console.log("Environment: OK");
console.log("URL format: OK");
console.log(
  `Key type: ${serverKey.startsWith("sb_secret_") ? "secret" : "legacy/unknown"}`,
);

let failed = false;
for (const table of ["shops", "wins", "shop_stats", "sync_runs"]) {
  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}?select=*&limit=1`,
      {
        headers: {
          apikey: serverKey,
          Authorization: `Bearer ${serverKey}`,
          Accept: "application/json",
        },
      },
    );

    const body = await response.text();
    if (response.ok) {
      console.log(`${table}: OK (HTTP ${response.status})`);
      continue;
    }

    failed = true;
    let detail = "non-JSON error response";
    try {
      const error = JSON.parse(body);
      detail = [error.code, error.message, error.hint].filter(Boolean).join(" | ");
    } catch {
      // Keep the safe generic message. Never print response bodies here.
    }
    console.log(`${table}: FAILED (HTTP ${response.status}) ${detail}`);
  } catch (error) {
    failed = true;
    console.log(`${table}: FAILED (network) ${error.message}`);
  }
}

if (failed) process.exitCode = 1;
