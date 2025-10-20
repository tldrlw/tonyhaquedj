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

  // ✅ Centralized padding for all table cells
  const cellStyle = {
    padding: "12px 20px",
    verticalAlign: "middle",
  };

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
          return db - da;
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
        maxWidth: "100%",
      }}
    >
      <h2
        style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}
      >
        @tony_haque chunes
        <a
          href="https://instagram.com/tony_haque"
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "#E1306C" }}
          >
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" />
          </svg>
        </a>
        <a
          href="https://www.tiktok.com/@tony_haque"
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 256 256"
            fill="currentColor"
            style={{ color: "#000000" }}
          >
            <path d="M178.5 0c10.2 19.7 26.8 35.3 47.5 43.5V91c-21.7-0.2-42.4-6.5-60-17.7v82.7c0 55.5-45 100.5-100.5 100.5C29 256 0 227 0 191.5S29 127 65.5 127c4.5 0 8.9 0.3 13.2 1v45.3c-4.2-1.3-8.7-2-13.2-2-20.7 0-37.5 16.8-37.5 37.5s16.8 37.5 37.5 37.5c20.7 0 37.5-16.8 37.5-37.5V0h65.5z" />
          </svg>
        </a>
      </h2>
      <p style={{ marginTop: 8 }}>
        <b>total:</b> {manifest.rowCount} &nbsp;|&nbsp;
        <b>updated:</b> {prettyDate(manifest.updated)} EST &nbsp;|&nbsp;
        <b>JSON</b>{" "}
        <a href={manifest.url} target="_blank" rel="noreferrer">
          snapshot
        </a>
      </p>

      {/* ✅ Responsive table container */}
      <div style={{ overflowX: "auto", marginTop: 24 }}>
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            width: "100%",
            minWidth: "1000px",
            fontSize: "14px",
            lineHeight: "1",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#ef4c40",
                textAlign: "left",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              <th style={{ ...cellStyle, width: "70px" }}>id</th>
              <th style={{ ...cellStyle, minWidth: "60px" }}>name</th>
              <th style={{ ...cellStyle, minWidth: "80px" }}>artists</th>
              <th style={{ ...cellStyle, minWidth: "150px" }}>mix</th>
              <th style={{ ...cellStyle, minWidth: "240px" }}>label</th>
              <th style={{ ...cellStyle, width: "60px" }}>bpm</th>
              <th style={{ ...cellStyle, width: "80px" }}>camelot 🗝</th>
              <th style={{ ...cellStyle, width: "80px" }}>musical 🗝</th>
              <th style={{ ...cellStyle, width: "100px" }}>released</th>
              <th style={{ ...cellStyle, width: "100px" }}>bought</th>
              <th style={{ ...cellStyle, width: "80px" }}>size (mb)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                style={{
                  borderTop: "1px solid #eee",
                  backgroundColor: i % 2 === 0 ? "white" : "#99c9c1",
                }}
              >
                <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                  {r.track_id}
                </td>
                <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                  {r.track_name}
                </td>
                <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                  {r.artists}
                </td>
                <td style={cellStyle}>{r.mix_name}</td>
                <td style={cellStyle}>{r.label}</td>
                <td style={cellStyle}>{r.bpm ?? ""}</td>
                <td style={cellStyle}>{r.camelot_key || ""}</td>
                <td style={cellStyle}>{r.musical_key || ""}</td>
                <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                  {r.release_date
                    ? new Date(r.release_date).toLocaleDateString()
                    : ""}
                </td>
                <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                  {r.purchase_date
                    ? new Date(r.purchase_date).toLocaleDateString()
                    : ""}
                </td>
                <td style={cellStyle}>
                  {r.size?.toFixed ? r.size.toFixed(2) : r.size}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
