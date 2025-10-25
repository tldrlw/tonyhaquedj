// src/components/SubHeader.jsx
export default function SubHeader({
  rowCount,
  updatedIso,
  snapshotUrl,
  timezoneLabel = "EST",
}) {
  // Localized formatter (encapsulated here so App.jsx stays clean)
  const prettyDate = (s) => {
    try {
      return new Date(s).toLocaleString("en-US", {
        timeZone: "America/New_York",
      });
    } catch {
      return s ?? "";
    }
  };
  return (
    <div className="container">
      <p className="d-flex flex-column">
        <span>
          updated:{" "}
          <b>
            {prettyDate(updatedIso)} {timezoneLabel}
          </b>
        </span>
        <span>
          <a
            href="https://www.tiktok.com/@tony_haque"
            target="_blank"
            rel="noreferrer"
          >
            TikTok
          </a>{" "}
          (I do live DJ sets here)
        </span>
        <span>
          <a href={snapshotUrl} target="_blank" rel="noreferrer">
            snapshot JSON
          </a>
        </span>
        <span>
          total: <b>{rowCount}</b>
        </span>
        <span>
          <a
            href="https://instagram.com/tony_haque"
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
        </span>
      </p>
    </div>
  );
}
