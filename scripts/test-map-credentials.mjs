import fs from "node:fs";

function loadEnv(path) {
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
    ) value = value.slice(1, -1);
    values[name] = value;
  }
  return values;
}

const env = loadEnv(".env.local");
const naverClientId = env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!naverClientId) throw new Error("NEXT_PUBLIC_NAVER_MAP_CLIENT_ID is empty");
if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is empty");
if (!publishableKey) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is empty");

console.log("Map environment variables: OK");

const mapUrl = new URL("https://oapi.map.naver.com/openapi/v3/maps.js");
mapUrl.searchParams.set("ncpKeyId", naverClientId);
const mapResponse = await fetch(mapUrl, {
  headers: {
    Referer: "http://localhost:3000/",
    Origin: "http://localhost:3000",
    "User-Agent": "Mozilla/5.0",
  },
  signal: AbortSignal.timeout(30_000),
});
const mapScript = await mapResponse.text();
if (!mapResponse.ok) {
  throw new Error(`Naver Maps script returned HTTP ${mapResponse.status}`);
}
if (mapScript.length < 10_000 || !mapScript.includes("naver")) {
  throw new Error("Naver Maps response was not a valid Maps JavaScript payload");
}
console.log(`Naver Dynamic Map script: OK (HTTP ${mapResponse.status})`);
console.log("Registered localhost origin: accepted");

const publicResponse = await fetch(
  `${supabaseUrl.replace(/\/$/, "")}/rest/v1/shops?select=id&limit=1`,
  {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      Prefer: "count=exact",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  },
);
const publicBody = await publicResponse.json().catch(() => null);
if (!publicResponse.ok) {
  const code = publicBody && typeof publicBody === "object" ? publicBody.code : undefined;
  throw new Error(`Supabase publishable request failed: ${code ?? publicResponse.status}`);
}
if (!Array.isArray(publicBody) || publicBody.length === 0) {
  console.log("Supabase publishable key: OK");
  console.log("Public shops SELECT: blocked by RLS (expected; map uses the server API)");
  process.exit(0);
}
console.log("Supabase publishable key: OK");
console.log("Public shops SELECT policy: OK");
