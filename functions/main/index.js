import { BigQuery } from "@google-cloud/bigquery";
import { Storage } from "@google-cloud/storage";
import { parseBeatportFilename } from "./beatport-filename.js";

const bigquery = new BigQuery();
const storage = new Storage();

const DATASET = process.env.BQ_DATASET || "chunes";
const TABLE = process.env.BQ_TABLE || "tracks";
const FORCE_METADATA_SIZE =
  (process.env.FORCE_METADATA_SIZE || "false").toLowerCase() === "true";

// unmistakable cold-start banner
console.log(
  JSON.stringify({
    severity: "INFO",
    message: "Cold start: function boot",
    dataset: DATASET,
    table: TABLE,
    forceMetadataSize: FORCE_METADATA_SIZE,
    ts: new Date().toISOString(),
  })
);

/* ---------------- utils ---------------- */
function safe(v) {
  try {
    if (v instanceof Error) {
      const { name, message, stack, ...rest } = v;
      return JSON.stringify({ name, message, stack, ...rest });
    }
    return JSON.stringify(v);
  } catch {
    try {
      return String(v);
    } catch {
      return "[unserializable]";
    }
  }
}
function log(level, message, extra = {}) {
  const rec = { severity: level.toUpperCase(), message, ...extra };
  try {
    console[level]?.(safe(rec));
  } catch {
    console[level]?.(
      JSON.stringify({ severity: level.toUpperCase(), message })
    );
  }
  try {
    const hint = Object.entries(extra)
      .slice(0, 6)
      .map(([k, v]) => `${k}=${typeof v === "string" ? v : safe(v)}`)
      .join(" ");
    const line = `▶ ${message}${hint ? " | " + hint : ""}`;
    if (level === "error") console.error(line);
    else if (level === "warning") console.warn(line);
    else console.log(line);
  } catch {}
}

/* ---------------- CloudEvent helpers ---------------- */
function bucketFromSource(src) {
  if (!src) return null;
  const m = src.match(/\/buckets\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}
function nameFromSubject(subj) {
  if (!subj) return null;
  return subj.startsWith("objects/")
    ? decodeURIComponent(subj.slice("objects/".length))
    : null;
}
function parseFromId(id) {
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

/* ---------------- type helpers ---------------- */
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const toTimestamp = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.valueOf()) ? d.toISOString() : null;
};
const toStr = (v) => (v == null ? null : String(v));

async function resolveBytes({ bucket, name, sizeFromEvent }) {
  log("info", "resolveBytes:enter", { bucket, name, sizeFromEvent });

  // Only trust the event size if it is actually present (not null/undefined/"")
  const hasEventSize =
    sizeFromEvent !== undefined &&
    sizeFromEvent !== null &&
    sizeFromEvent !== "";

  if (hasEventSize) {
    const n = Number(sizeFromEvent);
    if (Number.isFinite(n) && n >= 0) {
      log("info", "resolveBytes:usingEventSize", { bytes: n });
      return n;
    }
    log("warning", "resolveBytes:eventSizeUnusable", { sizeFromEvent });
  } else {
    log("info", "resolveBytes:noEventSizePresent");
  }

  // Fallback to GCS metadata
  try {
    const file = storage.bucket(bucket).file(name);
    const [exists] = await file.exists();
    log("info", "resolveBytes:file.exists()", { exists });

    if (!exists) {
      log("warning", "resolveBytes:fileNotFound", { bucket, name });
      return null;
    }

    const [meta] = await file.getMetadata();
    const m = Number(meta?.size);
    log("info", "resolveBytes:fetchedMetadata", {
      metaSize: meta?.size,
      contentType: meta?.contentType,
      storageClass: meta?.storageClass,
      updated: meta?.updated,
    });

    if (Number.isFinite(m) && m >= 0) return m;
    return null;
  } catch (e) {
    log("error", "resolveBytes:metadataFetchFailed", {
      error: e?.message || String(e),
      code: e?.code,
    });
    return null;
  }
}

/* ---------------- BQ helpers ---------------- */
async function getTable() {
  const t0 = Date.now();
  const ds = bigquery.dataset(DATASET);
  const table = ds.table(TABLE);
  try {
    const [[projectId], [dsMeta], [tblMeta]] = await Promise.all([
      bigquery
        .getProjectId()
        .then((id) => [id])
        .catch(() => [null]),
      ds
        .get()
        .then(([meta]) => [meta])
        .catch(() => [null]),
      table
        .get()
        .then(([meta]) => [meta])
        .catch(() => [null]),
    ]);
    const fields =
      tblMeta?.schema?.fields?.map((f) => `${f.name}:${f.type}`) || [];
    log("info", "BigQuery table check", {
      projectId,
      datasetId: DATASET,
      tableId: TABLE,
      dsLocation: dsMeta?.location,
      tblLocation: tblMeta?.location,
      fields,
      timeMs: Date.now() - t0,
    });
    return table;
  } catch (err) {
    log("error", "Failed to access dataset/table", {
      error: err?.message || String(err),
    });
    throw err;
  }
}

/* ---------------- core processor ---------------- */
async function processObject({
  bucket,
  name: objectName,
  sizeBytes,
  generation,
  insertId,
}) {
  if (!bucket || !objectName) {
    log("warning", "Ignoring event without bucket/name");
    return { skipped: true, reason: "missing-bucket-or-name" };
  }

  if (!/\.(mp3|wav|aiff|flac|m4a|aac|ogg)$/i.test(objectName)) {
    log("info", "Skipping non-audio object", { objectName });
    return { skipped: true, reason: "non-audio", objectName };
  }

  const parsed = parseBeatportFilename(objectName);
  if (parsed?.error) {
    log("warning", "Filename parse error", {
      objectName,
      error: parsed.error,
      parsedPreview: parsed,
    });
    return { skipped: true, reason: parsed.error, objectName };
  }
  log("info", "Parsed filename", { objectName, parsedPreview: parsed });

  const normalized = {
    track_id: toInt(parsed.track_id),
    track_name: toStr(parsed.track_name),
    artists: toStr(parsed.artists),
    mix_name: toStr(parsed.mix_name),
    bpm: toInt(parsed.bpm),
    musical_key: toStr(parsed.musical_key),
    camelot_key: toStr(parsed.camelot_key),
    label: toStr(parsed.label),
    release_date: toTimestamp(parsed.release_date),
    purchase_date: toTimestamp(parsed.purchase_date),
    file_ext: toStr(parsed.file_ext),
  };

  // Convert BYTES → MB (2 decimals) — allow 0-byte files to become 0.0
  const bytes = Number.isFinite(sizeBytes) ? sizeBytes : null;
  const sizeMB =
    bytes === null ? null : Number((bytes / (1024 * 1024)).toFixed(2));

  const row = {
    gcs_bucket: toStr(bucket),
    gcs_object: toStr(objectName),
    gcs_generation: toStr(generation || null),
    size: sizeMB,
    ...normalized,
    ingested_at: new Date().toISOString(),
  };

  const preview = Object.fromEntries(Object.entries(row).slice(0, 12));
  log("info", "Prepared BQ row (preview)", {
    insertId: insertId || objectName,
    preview,
  });

  const table = await getTable();
  const rows = [{ insertId: insertId || objectName, json: row }];

  try {
    log("info", "Inserting row to BigQuery (raw)", {
      dataset: DATASET,
      table: TABLE,
    });
    const t0 = Date.now();
    const [resp] = await table.insert(rows, {
      raw: true,
      skipInvalidRows: false,
      ignoreUnknownValues: false,
    });

    log("info", "BQ insert completed", {
      elapsedMs: Date.now() - t0,
      hasInsertErrors: !!resp?.insertErrors?.length,
    });

    if (resp?.insertErrors?.length) {
      log("error", "BQ insert returned insertErrors", {
        insertErrors: resp.insertErrors,
      });
      return {
        failed: true,
        reason: "bq-insert-errors",
        details: resp.insertErrors,
      };
    }

    log("info", "Inserted row to BigQuery", { objectName, sizeMB });
    return { inserted: true, row };
  } catch (err) {
    const isPartial =
      err?.name === "PartialFailureError" || Array.isArray(err?.errors);
    if (isPartial) {
      const perRow = (err.errors || []).map((e, idx) => ({
        index: idx,
        rowKeys: Object.keys(e.row || {}),
        errors: e.errors,
      }));
      log("error", "BigQuery partial failure", {
        message: err.message,
        perRow,
      });
    } else {
      log("error", "BigQuery insert failed (exception)", {
        message: err?.message || String(err),
        code: err?.code,
        errors: err?.errors,
        stack: err?.stack,
      });
    }
    return { failed: true, reason: "bq-insert-failed" };
  }
}

/* ---------------- handlers ---------------- */
export async function handleGcsFinalize(cloudEvent) {
  const tStart = Date.now();

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
  let generation = d.generation ?? d.metaGeneration ?? null;

  if (!bucket) bucket = bucketFromSource(cloudEvent?.source);
  if (!name) name = nameFromSubject(cloudEvent?.subject);
  if (!bucket || !name || !generation) {
    const fromId = parseFromId(cloudEvent?.id);
    bucket = bucket || fromId.bucket;
    name = name || fromId.name;
    generation = generation || fromId.generation;
  }

  const rawSize = d.size ?? d.contentLength ?? null;
  const insertId = cloudEvent?.id || `${name}:${generation}` || name;

  log("info", "Resolved event fields", { bucket, name, generation, rawSize });

  // Ensure numeric bytes (prefer event, optionally force metadata)
  const bytes = await resolveBytes({ bucket, name, sizeFromEvent: rawSize });
  log("info", "Size resolution result", { bucket, name, bytes });

  const result = await processObject({
    bucket,
    name,
    sizeBytes: bytes, // number (bytes) or null
    generation,
    insertId,
  });

  log("info", "Handler complete", {
    result: result?.inserted
      ? "inserted"
      : result?.skipped
      ? "skipped"
      : "failed",
    elapsedMs: Date.now() - tStart,
  });
}

// Optional HTTP backfill/manual entrypoint
export async function manualIngest(req, res) {
  const t0 = Date.now();
  try {
    const {
      bucket,
      name,
      size = null,
      insertId = null,
      generation = null,
    } = req.body || {};
    log("info", "Manual ingest request", { bucket, name, generation, size });
    const result = await processObject({
      bucket,
      name,
      sizeBytes: size,
      insertId,
      generation,
    });
    res.status(200).json({ ...result, elapsedMs: Date.now() - t0 });
  } catch (err) {
    log("error", "Manual ingest failed", {
      error: err?.message || String(err),
      stack: err?.stack,
    });
    res.status(400).json({ error: String(err?.message || err) });
  }
}
