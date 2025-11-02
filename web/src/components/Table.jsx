export default function Table({ rows, prettyDate, prettyMB }) {
  // Local helper for truncation (keeps your UI tight without extra CSS)
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
    // Full-bleed friendly wrapper; only scrolls below md
    <div className="table-responsive-md mt-2 px-2 px-md-3">
      <table className="table table-sm table-striped table-hover align-middle mb-0 w-100">
        <thead className="table-danger sticky-top" style={{ zIndex: 1 }}>
          <tr>
            <th scope="col" style={{ width: "7ch", whiteSpace: "nowrap" }}>
              id
            </th>
            <th scope="col">name</th>
            <th scope="col">artists</th>
            <th scope="col" style={{ width: "9ch", whiteSpace: "nowrap" }}>
              ck
            </th>
            <th scope="col" style={{ width: "6ch", whiteSpace: "nowrap" }}>
              bpm
            </th>
            <th scope="col" style={{ width: "9ch", whiteSpace: "nowrap" }}>
              mk
            </th>
            <th scope="col" className="d-none d-sm-table-cell">
              mix
            </th>
            <th scope="col">label</th>
            <th scope="col" style={{ width: "10ch", whiteSpace: "nowrap" }}>
              released
            </th>
            <th scope="col" style={{ width: "10ch", whiteSpace: "nowrap" }}>
              bought
            </th>
            <th
              scope="col"
              className="d-none d-sm-table-cell"
              style={{ width: "9ch", whiteSpace: "nowrap" }}
            >
              size (mb)
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="text-nowrap">{r.track_id}</td>
              <td>
                <Trunc text={r.track_name} max="26ch" />
              </td>
              <td>
                <Trunc text={r.artists} max="26ch" />
              </td>
              <td>{r.camelot_key || ""}</td>
              <td>{r.bpm ?? ""}</td>
              <td>{r.musical_key || ""}</td>
              <td className="d-none d-sm-table-cell">
                <Trunc text={r.mix_name} max="18ch" />
              </td>
              <td>
                <Trunc text={r.label} max="24ch" />
              </td>
              <td className="text-nowrap">
                {r.release_date ? prettyDate(r.release_date) : ""}
              </td>
              <td className="text-nowrap">
                {r.purchase_date ? prettyDate(r.purchase_date) : ""}
              </td>
              <td className="d-none d-sm-table-cell">{prettyMB(r.size)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
