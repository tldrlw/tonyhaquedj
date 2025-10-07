// functions/main/index.js
import { BigQuery } from "@google-cloud/bigquery";
import { parseBeatportFilename } from "./beatport-filename.js";

const bigquery = new BigQuery();
const DATASET = process.env.BQ_DATASET || "chunes";
const TABLE = process.env.BQ_TABLE || "tracks";

/* ---------------- logging ---------------- */
function log(level, message, extra = {}) {
  const rec = { severity: level.toUpperCase(), message, ...extra };
  // structured (great for Log Explorer filters)
  console[level]?.(JSON.stringify(rec));
  // human one-liner (shows up in summary column)
  try {
    const hint = Object.entries(extra)
      .slice(0, 5)
      .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(" ");
    const line = `▶ ${message}${hint ? " | " + hint : ""}`;
    if (level === "error") console.error(line);
    else if (level === "warning") console.warn(line);
    else console.log(line);
  } catch {}
}

/* ---------------- CloudEvent helpers ---------------- */
function bucketFromSource(src) {
  // //storage.googleapis.com/projects/_/buckets/<bucket>
  if (!src) return null;
  const m = src.match(/\/buckets\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}
function nameFromSubject(subj) {
  // "objects/path/to/file.ext"
  if (!subj) return null;
  return subj.startsWith("objects/")
    ? decodeURIComponent(subj.slice("objects/".length))
    : null;
}
function parseFromId(id) {
  // "<bucket>/<object>/<generation>"
  if (!id || typeof id !== "string")
    return { bucket: null, name: null, generation: null };
  const first = id.indexOf("/");
  const last = id.lastIndexOf("/");
  if (first <= 0 || last <= first)
    return { bucket: null, name: null, generation: null };
  return {
    bucket: id.slice(0, first),
    name: id.slice(first + 1, last),
    generation: id.slice(last + 1),
  };
}

/* ---------------- core processor ---------------- */
async function processObject({
  bucket,
  name: objectName,
  size,
  contentType,
  insertId,
}) {
  if (!bucket || !objectName) {
    log("warning", "Ignoring event without bucket/name");
    return { skipped: true, reason: "missing-bucket-or-name" };
  }

  // only audio
  if (!/\.(mp3|wav|aiff|flac|m4a|aac|ogg)$/i.test(objectName)) {
    log("info", "Skipping non-audio object", { objectName, contentType });
    return { skipped: true, reason: "non-audio", objectName };
  }

  const parsed = parseBeatportFilename(objectName);
  if (parsed?.error) {
    log("warning", "Filename parse error", { objectName, error: parsed.error });
    return { skipped: true, reason: parsed.error, objectName };
  }

  const row = {
    gcs_bucket: bucket,
    gcs_object: objectName,
    size_bytes: size ? Number(size) : null,
    content_type: contentType || null,
    ...parsed,
    ingested_at: new Date().toISOString(),
  };

  const rows = [{ insertId: insertId || objectName, json: row }];
  try {
    log("info", "Inserting row to BigQuery", {
      dataset: DATASET,
      table: TABLE,
      objectName,
    });
    await bigquery.dataset(DATASET).table(TABLE).insert(rows);
    log("info", "Inserted row to BigQuery", { objectName });
    return { inserted: true, row };
  } catch (err) {
    log("error", "BigQuery insert failed", {
      objectName,
      error: err?.message || String(err),
      details: err?.errors || err,
    });
    return { failed: true, reason: "bq-insert-failed" };
  }
}

/* ---------------- handlers ---------------- */
export async function handleGcsFinalize(cloudEvent) {
  // One concise dump (shape information)
  console.log(
    "RAW_CLOUD_EVENT",
    JSON.stringify({
      id: cloudEvent?.id,
      type: cloudEvent?.type,
      source: cloudEvent?.source,
      subject: cloudEvent?.subject,
      time: cloudEvent?.time,
      hasData: !!cloudEvent?.data,
      dataKeys: cloudEvent?.data ? Object.keys(cloudEvent.data) : [],
    })
  );

  // Resolve fields from data → subject/source → id
  const d = cloudEvent?.data ?? {};
  let bucket = d.bucket ?? d.bucketName ?? null;
  let name = d.name ?? d.objectId ?? null;

  if (!bucket) bucket = bucketFromSource(cloudEvent?.source);
  if (!name) name = nameFromSubject(cloudEvent?.subject);
  if (!bucket || !name) {
    const fromId = parseFromId(cloudEvent?.id);
    bucket = bucket || fromId.bucket;
    name = name || fromId.name;
  }

  const size = d.size ?? d.contentLength ?? null;
  const contentType = d.contentType ?? d.mimeType ?? null;
  const insertId = cloudEvent?.id || name; // prefer CE id (includes generation)

  log("info", "Resolved event fields", { bucket, name, size, contentType });

  await processObject({ bucket, name, size, contentType, insertId });
}

// Optional HTTP backfill/manual entrypoint
export async function manualIngest(req, res) {
  try {
    const {
      bucket,
      name,
      size = null,
      contentType = null,
      insertId = null,
    } = req.body || {};
    log("info", "Manual ingest request", { bucket, name });
    const result = await processObject({
      bucket,
      name,
      size,
      contentType,
      insertId,
    });
    res.status(200).json(result);
  } catch (err) {
    log("error", "Manual ingest failed", {
      error: err?.message || String(err),
    });
    res.status(400).json({ error: String(err?.message || err) });
  }
}
