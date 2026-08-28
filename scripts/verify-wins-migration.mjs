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
    ) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

const env = loadEnv(".env.local");
const baseUrl = env.SUPABASE_URL?.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !key) throw new Error("Supabase environment variables are missing");

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
};

const columnsResponse = await fetch(
  `${baseUrl}/rest/v1/wins?select=source_rnum,occurrence&limit=0`,
  { headers },
);
if (!columnsResponse.ok) {
  const error = await columnsResponse.json().catch(() => ({}));
  throw new Error(`Migration columns unavailable: ${error.code ?? columnsResponse.status}`);
}
console.log("wins.source_rnum: OK");
console.log("wins.occurrence: OK");

// PostgreSQL resolves the ON CONFLICT target before checking this deliberately
// invalid row. 23502 therefore proves the four-column unique target exists,
// while 42P10 means no matching unique/exclusion constraint exists. No row can
// be inserted because shop_id, round, and rank are explicitly null.
const constraintResponse = await fetch(
  `${baseUrl}/rest/v1/wins?on_conflict=shop_id,round,rank,occurrence`,
  {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      shop_id: null,
      round: null,
      rank: null,
      occurrence: 1,
      source_rnum: null,
    }),
  },
);

const constraintError = await constraintResponse.json().catch(() => ({}));
if (constraintResponse.ok) {
  throw new Error("Safety assertion failed: invalid verification row was accepted");
}
if (constraintError.code === "42P10") {
  throw new Error("Four-column unique constraint is not available to PostgREST");
}
if (constraintError.code !== "23502") {
  throw new Error(
    `Unique target verification returned an unexpected safe failure: ${constraintError.code ?? constraintResponse.status}`,
  );
}

console.log("unique(shop_id, round, rank, occurrence): OK");
console.log("Verification row persisted: NO");

const oldConstraintResponse = await fetch(
  `${baseUrl}/rest/v1/wins?on_conflict=shop_id,round,rank`,
  {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      shop_id: null,
      round: null,
      rank: null,
      occurrence: 1,
      source_rnum: null,
    }),
  },
);

const oldConstraintError = await oldConstraintResponse.json().catch(() => ({}));
if (oldConstraintError.code !== "42P10") {
  throw new Error(
    `Old three-column unique constraint may still exist: ${oldConstraintError.code ?? oldConstraintResponse.status}`,
  );
}

console.log("old unique(shop_id, round, rank) removed: OK");
