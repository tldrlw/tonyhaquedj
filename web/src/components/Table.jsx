import "./Table.css";

export default function Table({ rows, prettyDate, prettyMB }) {
  // shared truncation helper
  const Trunc = ({ text }) => (
    <span className="trunc-cell" title={text || ""}>
      {text || ""}
    </span>
  );

  // 👇 master column config
  const COLUMNS = [
    {
      key: "track_name",
      header: "name",
      className: "col-wide",
      render: (r) => <Trunc text={r.track_name} />,
    },
    {
      key: "artists",
      header: "artist(s)",
      className: "col-wide",
      render: (r) => <Trunc text={r.artists} />,
    },
    {
      key: "camelot_key",
      header: "ck",
      className: "col-narrow text-nowrap",
      render: (r) => r.camelot_key || "",
    },
    {
      key: "bpm",
      header: "bpm",
      className: "col-narrow text-nowrap",
      render: (r) => r.bpm ?? "",
    },
    {
      key: "release_date",
      header: "released",
      className: "col-narrow-date text-nowrap",
      render: (r) => (r.release_date ? prettyDate(r.release_date) : ""),
    },
    {
      key: "label",
      header: "label/notes",
      className: "col-wide",
      render: (r) => <Trunc text={r.label} />,
    },
    {
      key: "musical_key",
      header: "mk",
      className: "col-narrow text-nowrap",
      render: (r) => r.musical_key || "",
    },
    {
      key: "track_id",
      header: "id",
      className: "col-narrow text-nowrap",
      render: (r) => r.track_id,
    },
    {
      key: "mix_name",
      header: "mix",
      // still hide on xs like before
      className: "col-wide d-none d-sm-table-cell",
      render: (r) => <Trunc text={r.mix_name} />,
    },
    {
      key: "purchase_date",
      header: "downloaded",
      className: "col-narrow-date text-nowrap",
      render: (r) => (r.purchase_date ? prettyDate(r.purchase_date) : ""),
    },
    {
      key: "size",
      header: "size (mb)",
      // hide on xs like before
      className: "col-narrow d-none d-sm-table-cell text-nowrap",
      render: (r) => prettyMB(r.size),
    },
  ];

  return (
    <div className="table-responsive-md mt-2 px-2 px-md-3">
      <table className="table table-sm table-striped table-hover align-middle mb-0 w-100">
        <thead className="table-danger sticky-top" style={{ zIndex: 1 }}>
          <tr>
            {COLUMNS.map((col, i) => (
              <th key={i} scope="col" className={col.className}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, rowIndex) => (
            <tr key={rowIndex}>
              {COLUMNS.map((col, colIndex) => (
                <td key={colIndex} className={col.className}>
                  {col.render
                    ? col.render(r)
                    : // default fallback: show raw field if you didn't give a render fn
                      r[col.key] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* (Optional) tiny legend for very small screens */}
      <p className="text-secondary small mt-2 mb-3">
        <span className="d-inline d-sm-none">
          On small screens, <b>mix</b> and <b>size</b> are hidden for
          readability.
        </span>
      </p>
    </div>
  );
}
