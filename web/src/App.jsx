import Header from "./components/Header";
import SubHeader from "./components/SubHeader";
import Table from "./components/Table";
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
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

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

      // const sorted = [...data].sort((a, b) => {
      //   const da = a.release_date ? new Date(a.release_date) : 0;
      //   const db = b.release_date ? new Date(b.release_date) : 0;
      //   return db - da;
      // });

      const sorted = [...data].sort((a, b) => {
        const nameA = a.track_name?.toLowerCase() || "";
        const nameB = b.track_name?.toLowerCase() || "";
        return nameA.localeCompare(nameB);
      });

      setRows(sorted);
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

  if (!manifest || !rows) {
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

  // Truncate helper (tooltip shows full text)
  const Trunc = ({ text, max = "22ch" }) => (
    <span
      className="d-inline-block text-truncate align-middle"
      style={{ maxWidth: max }}
      title={text || ""}
    >
      {text || ""}
    </span>
  );

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
      <Table rows={rows} prettyDate={prettyDate} prettyMB={prettyMB} />
      {/* (Optional) tiny legend for very small screens */}
      <p className="text-secondary small mt-2 px-3 mb-3">
        <span className="d-inline d-sm-none">
          On small screens, <b>mix</b> and <b>size</b> are hidden for
          readability.
        </span>
      </p>
    </div>
  );
}
