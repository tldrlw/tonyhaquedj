import "./globals.css";
import Header from "./components/Header";
import SubHeader from "./components/SubHeader";
import Table from "./components/Table";
import ViewModeTabs from "./components/ViewModeTabs";
import Charts from "./components/Charts";
import { getSortedRows } from "./utils/sorters";
import { useEffect, useState } from "react";

const MANIFEST_URL =
  "https://storage.googleapis.com/chunes-snapshots-dulcet-provider-474401-d3-us-central1/manifest/latest.json";

function prettyDate(s) {
  try {
    const d = new Date(s);
    // Force UTC formatting so midnight UTC stays "24" not "23"
    return d.toLocaleDateString("en-US", {
      timeZone: "UTC",
    });
  } catch {
    return s ?? "";
  }
}

function prettyMB(v) {
  if (v == null) return "";
  return typeof v === "number" ? v.toFixed(2) : v;
}

export default function App() {
  const [manifest, setManifest] = useState(null);
  const [rowsRaw, setRowsRaw] = useState(null);
  const [error, setError] = useState("");
  // "alpha" = alphabetical by track name
  // "artists"  = sort by artists A→Z
  // "camelot" = group/sort by Camelot key
  // "bought" = newest purchase first
  const [viewMode, setViewMode] = useState("alpha");

  const load = async () => {
    setError("");
    try {
      const mRes = await fetch(MANIFEST_URL, { cache: "no-cache" });
      if (!mRes.ok) throw new Error(`Manifest HTTP ${mRes.status}`);
      const m = await mRes.json();
      setManifest(m);

      const sRes = await fetch(m.url, { cache: "no-cache" });
      if (!sRes.ok) throw new Error(`Snapshot HTTP ${sRes.status}`);
      const data = await sRes.json();

      setRowsRaw(data);
    } catch (e) {
      setError(String(e?.message || e));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="container py-4">
        <div
          className="alert alert-danger d-flex justify-content-between align-items-center"
          role="alert"
        >
          <div>❌ {error}</div>
          <button className="btn btn-sm btn-outline-dark" onClick={load}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const sortedRows = getSortedRows(rowsRaw, viewMode);

  if (!manifest || !rowsRaw) {
    return (
      <div className="container py-5 d-flex justify-content-center">
        <div className="d-flex align-items-center gap-3">
          <div
            className="spinner-border"
            role="status"
            aria-hidden="true"
          ></div>
          <strong>Loading…</strong>
        </div>
      </div>
    );
  }

  return (
    // ⬇️ Make the page a fluid canvas with **no side padding**
    <div className="container-fluid px-0">
      {/* Keep header/meta nicely centered */}
      <Header />
      <SubHeader
        rowCount={manifest.rowCount}
        updatedIso={manifest.updated}
        snapshotUrl={manifest.url}
      />
      <ViewModeTabs viewMode={viewMode} setViewMode={setViewMode} />
      {/* ⬇️ NEW: show the chart view instead of the table */}
      {viewMode === "charts" ? (
        <Charts rows={rowsRaw} />
      ) : (
        <Table rows={sortedRows} prettyDate={prettyDate} prettyMB={prettyMB} />
      )}
    </div>
  );
}
