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
    <div className="mt-3">
      {/* <div className="d-flex gap-2 small"> */}
      <div className="d-flex flex-wrap gap-2 small">
        <ViewModeButton
          mode="alpha"
          label="a → z"
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
        <ViewModeButton
          mode="artists"
          label="artist(s)"
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
        <ViewModeButton
          mode="camelot"
          label="camelot key (ck)"
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
        <ViewModeButton
          mode="bought"
          label="latest"
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
        <ViewModeButton
          mode="charts"
          label="charts"
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      </div>

      <div className="text-secondary small mt-2">
        {viewMode === "alpha" && (
          <span>sorted by name - default crate view</span>
        )}
        {viewMode === "artists" && (
          <span>sorted by artist(s) - useful for crate organization</span>
        )}
        {viewMode === "camelot" && (
          <span>grouped by camelot key - necessary for harmonic mixing</span>
        )}
        {viewMode === "bought" && (
          <span>sorted by most recently downloaded/bought</span>
        )}
        {viewMode === "charts" && <span>song data visualizations</span>}
      </div>
    </div>
  );
}
