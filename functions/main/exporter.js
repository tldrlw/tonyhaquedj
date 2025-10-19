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

export async function exportSnapshot(req, res) {
  try {
    const PROJECT_ID = process.env.PROJECT_ID;
    const DATASET = process.env.BQ_DATASET;
    const TABLE = process.env.BQ_TABLE;
    const BUCKET = process.env.GCS_BUCKET;
    const PREFIX = process.env.GCS_PREFIX;
    const BQ_LOCATION = process.env.BQ_LOCATION;

    if (!BUCKET) throw new Error("GCS_BUCKET is required");

    const fqTable = `\`${PROJECT_ID}.${DATASET}.${TABLE}\``;

    // Kick off query
    const [job] = await bq.createQueryJob({
      query: `SELECT * FROM ${fqTable} ORDER BY ingested_at`,
      location: BQ_LOCATION,
    });
    console.log(
      JSON.stringify({
        severity: "INFO",
        message: "Query started",
        jobId: job.id,
      })
    );

    // Prepare GCS destination
    const snapName = `${PREFIX.replace(/\/?$/, "/")}chunes-${stamp()}.json.gz`;
    const file = storage.bucket(BUCKET).file(snapName);

    // gzip → GCS write stream
    const gzip = createGzip();
    const fileWrite = file.createWriteStream({
      resumable: true,
      metadata: {
        contentType: "application/json",
        contentEncoding: "gzip",
        cacheControl: "public, max-age=86400, immutable",
      },
    });
    gzip.pipe(fileWrite);

    // Stream rows as a single JSON array
    gzip.write("[");
    let wrote = false;
    let pageToken;
    let totalRows = 0;

    while (true) {
      const [rows, , resp] = await job.getQueryResults({
        pageToken,
        maxResults: 50000,
        autoPaginate: false,
      });

      for (const r of rows) {
        if (wrote) gzip.write(",");
        gzip.write(JSON.stringify(r));
        wrote = true;
      }

      totalRows += rows.length;
      pageToken = resp?.pageToken;
      if (!pageToken) break;
    }

    gzip.write("]");
    gzip.end();

    // Wait for streams to finish
    await Promise.all([once(gzip, "end"), once(fileWrite, "finish")]);

    // Optional: attach rowCount to custom metadata
    await file.setMetadata({ metadata: { rowCount: String(totalRows) } });

    // Fetch object metadata for manifest extras
    const [meta] = await file.getMetadata();

    // Build + write manifest
    const manifest = {
      version: new Date().toISOString(),
      schemaVersion: 1,
      file: snapName,
      url: `https://storage.googleapis.com/${BUCKET}/${snapName}`,
      rowCount: totalRows,
      sizeCompressedBytes: Number(meta.size),
      md5Hash: meta.md5Hash, // base64
      crc32c: meta.crc32c, // base64
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

    res.status(200).send(`✅ Export complete: ${snapName} (${totalRows} rows)`);
  } catch (err) {
    console.error(err);
    res.status(500).send(`❌ Error: ${err.message}`);
  }
}
