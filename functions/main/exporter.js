// exporter.js
import { BigQuery } from "@google-cloud/bigquery";
import { Storage } from "@google-cloud/storage";
import { createGzip } from "node:zlib";
import { once } from "node:events";

const bq = new BigQuery();
const storage = new Storage();

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
    d.getHours()
  )}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * BigQuery’s Node.js client often represents TIMESTAMP fields as:
 *   { value: "2025-10-02T00:00:00.000Z" }
 * To keep your snapshot clean, we flatten only the expected timestamp fields.
 */
function flattenWhitelistedTimestamps(row) {
  for (const k of ["release_date", "purchase_date", "ingested_at"]) {
    const v = row[k];
    if (v && typeof v === "object" && "value" in v) row[k] = v.value;
  }
  return row;
}

// Promisify stream completion & errors in a compact way
function waitFor(stream, events = ["finish", "close"]) {
  return new Promise((resolve, reject) => {
    const done = () => resolve();
    events.forEach((e) => stream.once(e, done));
    stream.once("error", reject);
  });
}

export async function exportSnapshot(req, res) {
  const startTime = Date.now();
  try {
    // Env vars (non-sensitive only)
    const PROJECT_ID = process.env.PROJECT_ID;
    const DATASET = process.env.BQ_DATASET;
    const TABLE = process.env.BQ_TABLE;
    const BUCKET = process.env.GCS_BUCKET;
    const PREFIX = process.env.GCS_PREFIX;
    const BQ_LOCATION = process.env.BQ_LOCATION;

    // Validate env
    const missing = [
      ["PROJECT_ID", PROJECT_ID],
      ["BQ_DATASET", DATASET],
      ["BQ_TABLE", TABLE],
      ["GCS_BUCKET", BUCKET],
      ["GCS_PREFIX", PREFIX],
      ["BQ_LOCATION", BQ_LOCATION],
    ].filter(([, v]) => !v);
    if (missing.length) {
      const msg = `Missing env: ${missing.map(([k]) => k).join(", ")}`;
      console.error(`❌ ${msg}`);
      throw new Error(msg);
    }

    console.log(
      `✅ Env OK | PROJECT=${PROJECT_ID} DATASET=${DATASET} TABLE=${TABLE} BUCKET=${BUCKET} PREFIX=${PREFIX} LOCATION=${BQ_LOCATION}`
    );

    const fqTable = `\`${PROJECT_ID}.${DATASET}.${TABLE}\``;
    console.log(`📊 Exporting from ${fqTable} (ORDER BY ingested_at)`);

    // Query BigQuery
    const [job] = await bq.createQueryJob({
      query: `SELECT * FROM ${fqTable} ORDER BY ingested_at`,
      location: BQ_LOCATION,
    });
    console.log(`📡 BigQuery job started | jobId=${job.id}`);

    // Destination file
    const snapName = `${PREFIX.replace(/\/?$/, "/")}chunes-${stamp()}.json.gz`;
    const file = storage.bucket(BUCKET).file(snapName);
    console.log(`📁 Destination: gs://${BUCKET}/${snapName}`);

    // gzip → GCS write stream (with error hooks)
    const gzip = createGzip();
    const fileWrite = file.createWriteStream({
      resumable: true,
      metadata: {
        contentType: "application/json",
        contentEncoding: "gzip",
        cacheControl: "public, max-age=86400, immutable",
      },
    });

    // Attach explicit error logging (defensive)
    gzip.on("error", (e) => console.error(`❌ gzip error: ${e?.message || e}`));
    fileWrite.on("error", (e) =>
      console.error(`❌ GCS write error: ${e?.message || e}`)
    );

    gzip.pipe(fileWrite);

    // Stream rows as a single JSON array
    gzip.write("[");
    let wrote = false;
    let pageToken;
    let totalRows = 0;
    let pageCount = 0;

    while (true) {
      const [rows, , resp] = await job.getQueryResults({
        pageToken,
        maxResults: 50_000,
        autoPaginate: false,
      });

      pageCount++;
      totalRows += rows.length;
      console.log(
        `📄 Page ${pageCount}: ${rows.length} rows (total so far: ${totalRows})`
      );

      for (const raw of rows) {
        const r = flattenWhitelistedTimestamps(raw);
        if (wrote) gzip.write(",");
        gzip.write(JSON.stringify(r));
        wrote = true;
      }

      pageToken = resp?.pageToken;
      if (!pageToken) break;
    }

    if (!wrote) {
      console.warn("⚠️ No rows returned; writing empty array.");
    }

    gzip.write("]");
    gzip.end();

    // Wait for both streams to complete (and surface any errors)
    await Promise.all([
      waitFor(gzip, ["close"]),
      waitFor(fileWrite, ["finish"]),
    ]);

    console.log(
      `📦 Snapshot stream completed | rows=${totalRows}, pages=${pageCount}`
    );

    // Attach rowCount metadata
    await file.setMetadata({ metadata: { rowCount: String(totalRows) } });

    const [meta] = await file.getMetadata();
    console.log(
      `📄 GCS meta | size=${meta.size}B md5=${meta.md5Hash} crc32c=${meta.crc32c} gen=${meta.generation} updated=${meta.updated}`
    );

    // Create manifest
    const manifest = {
      version: new Date().toISOString(),
      schemaVersion: 1,
      file: snapName,
      url: `https://storage.googleapis.com/${BUCKET}/${snapName}`,
      rowCount: totalRows,
      sizeCompressedBytes: Number(meta.size),
      md5Hash: meta.md5Hash,
      crc32c: meta.crc32c,
      generation: meta.generation,
      updated: meta.updated,
    };

    await storage
      .bucket(BUCKET)
      .file("manifest/latest.json")
      .save(JSON.stringify(manifest), {
        contentType: "application/json",
        resumable: false,
        metadata: { cacheControl: "no-cache" },
      });

    const totalDurationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `✅ Export complete | url=${manifest.url} rows=${totalRows} durationSec=${totalDurationSec}`
    );

    res.status(200).send(`✅ Export complete: ${snapName} (${totalRows} rows)`);
  } catch (err) {
    console.error(`❌ Export failed: ${err?.message || err}`);
    if (err?.stack) console.error(err.stack);
    res.status(500).send(`❌ Error: ${err.message}`);
  }
}
