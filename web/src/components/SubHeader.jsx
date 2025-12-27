// src/components/SubHeader.jsx
import me from "../assets/me.jpg";

export default function SubHeader({
  rowCount,
  updatedIso,
  snapshotUrl,
  timezoneLabel = "EST",
}) {
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
      <div className="d-flex flex-column flex-md-row align-items-start gap-4">
        {/* LEFT: text (no flex-grow) */}
        <div>
          <p className="d-flex flex-column mb-0">
            <span>
              updated:{" "}
              <mark>
                {prettyDate(updatedIso)} {timezoneLabel}
              </mark>
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

        {/* RIGHT: image (controls layout width only) */}
        <div className="d-flex justify-content-md-end w-100">
          <img
            src={me}
            alt="Tony Haque"
            className="img-fluid"
            style={{
              maxWidth: "144px",
              width: "100%",
              aspectRatio: "1 / 1",
              objectFit: "cover",
            }}
          />
        </div>
      </div>
    </div>
  );
}
