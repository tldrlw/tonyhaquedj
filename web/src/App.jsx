import { useEffect, useState } from "react";

const MANIFEST_URL =
  "https://storage.googleapis.com/chunes-snapshots-dulcet-provider-474401-d3-us-central1/manifest/latest.json";

function prettyDate(s) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export default function App() {
  const [manifest, setManifest] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // --- Fetch manifest ---
        const mRes = await fetch(MANIFEST_URL, { cache: "no-cache" });
        if (!mRes.ok) throw new Error(`Manifest HTTP ${mRes.status}`);
        const m = await mRes.json();
        setManifest(m);

        // --- Fetch snapshot ---
        const sRes = await fetch(m.url, { cache: "no-cache" });
        if (!sRes.ok) throw new Error(`Snapshot HTTP ${sRes.status}`);
        const data = await sRes.json();

        // --- Sort by release_date (descending) ---
        const sorted = [...data].sort((a, b) => {
          const da = a.release_date ? new Date(a.release_date) : 0;
          const db = b.release_date ? new Date(b.release_date) : 0;
          return db - da; // newest first
        });

        setRows(sorted);
      } catch (e) {
        setError(String(e?.message || e));
      }
    })();
  }, []);

  if (error) return <div style={{ padding: 16 }}>❌ {error}</div>;
  if (!manifest || !rows) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 16,
        lineHeight: 1.4,
      }}
    >
      <h1 style={{ margin: 0 }}>Chunes</h1>
      <p style={{ marginTop: 8 }}>
        <b>Rows:</b> {manifest.rowCount} &nbsp;|&nbsp;
        <b>Updated:</b> {prettyDate(manifest.updated)} &nbsp;|&nbsp;
        <b>File:</b>{" "}
        <a href={manifest.url} target="_blank" rel="noreferrer">
          snapshot
        </a>
      </p>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th align="left">ID</th>
            <th align="left">Track</th>
            <th align="left">Artists</th>
            <th align="left">Mix Name</th>
            <th align="left">Label</th>
            <th align="left">BPM</th>
            <th align="left">Key</th>
            <th align="left">Released</th>
            <th align="left">Purchased</th>
            <th align="left">Size (MB)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid #eee" }}>
              <td>{r.track_id}</td>
              <td>{r.track_name}</td>
              <td>{r.artists}</td>
              <td>{r.mix_name}</td>
              <td>{r.label}</td>
              <td>{r.bpm ?? ""}</td>
              <td>{r.camelot_key || r.musical_key || ""}</td>
              <td>
                {r.release_date
                  ? new Date(r.release_date).toLocaleDateString()
                  : ""}
              </td>
              <td>
                {r.purchase_date
                  ? new Date(r.purchase_date).toLocaleDateString()
                  : ""}
              </td>
              <td>{r.size?.toFixed ? r.size.toFixed(2) : r.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
