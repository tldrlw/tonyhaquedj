function ViewModeButton({ mode, label, viewMode, setViewMode }) {
  const isActive = viewMode === mode;

  return (
    <button
      type="button"
      className={
        "btn btn-md transition " +
        (isActive ? "btn-primary" : "btn-outline-primary")
      }
      onClick={() => setViewMode(mode)}
    >
      {label}
    </button>
  );
}

export default function ViewModeTabs({ viewMode, setViewMode }) {
  return (
    <div className="container mt-3">
      <div className="d-flex gap-2 small">
        <ViewModeButton
          mode="alpha"
          label="A → Z"
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
        <ViewModeButton
          mode="artist"
          label="artist"
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
        <ViewModeButton
          mode="camelot"
          label="camelot key (ck)"
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      </div>

      <div className="text-secondary small mt-2">
        {viewMode === "alpha" && (
          <span>Sorted by track name (default crate view).</span>
        )}
        {viewMode === "artist" && (
          <span>Sorted by artist name (useful for crate organization).</span>
        )}
        {viewMode === "camelot" && (
          <span>
            Grouped by camelot key, then BPM. Great for harmonic mixing.
          </span>
        )}
      </div>
    </div>
  );
}
