// ----- helpers -----

function safeLower(v) {
  return (v || "").toLowerCase();
}

// numeric compare helpers so we don't repeat ourselves
function compareAsc(a, b) {
  return a - b;
}

function compareDesc(a, b) {
  return b - a;
}

// parse camelot key like "9A", "10B"
// returns { num: 9, letter: "A" } so we can sort numerically
function parseCamelotKey(ck) {
  const m = /^(\d+)([AB])$/i.exec(ck || "");
  if (!m) return { num: 0, letter: "A" };
  return { num: parseInt(m[1], 10), letter: m[2].toUpperCase() };
}

// safe timestamp → millis
function tsToMillis(ts) {
  // purchase_date is e.g. "2025-10-02T00:00:00.000Z"
  // If it's missing/null, treat as 0 so it sorts last in desc
  if (!ts) return 0;
  const d = new Date(ts);
  const ms = d.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

// ----- individual sorters -----

export function sortByTrackName(rows) {
  return [...rows].sort((a, b) => {
    const nameA = safeLower(a.track_name);
    const nameB = safeLower(b.track_name);
    return nameA.localeCompare(nameB);
  });
}

export function sortByArtist(rows) {
  return [...rows].sort((a, b) => {
    // 1. artists A→Z
    const artistA = safeLower(a.artists);
    const artistB = safeLower(b.artists);
    if (artistA !== artistB) {
      return artistA.localeCompare(artistB);
    }

    // 2. BPM high→low (energy first) (customize if you want low→high)
    const bpmA = a.bpm ?? 0;
    const bpmB = b.bpm ?? 0;
    if (bpmA !== bpmB) {
      return compareAsc(bpmA, bpmB);
    }

    // 3. track name A→Z as final stabler
    const nameA = safeLower(a.track_name);
    const nameB = safeLower(b.track_name);
    return nameA.localeCompare(nameB);
  });
}

export function sortByCamelot(rows) {
  return [...rows].sort((a, b) => {
    // 1. camelot key numeric first, then A/B
    const { num: numA, letter: letA } = parseCamelotKey(a.camelot_key);
    const { num: numB, letter: letB } = parseCamelotKey(b.camelot_key);

    if (numA !== numB) {
      return compareAsc(numA, numB); // 1A before 2A before 10A, etc.
    }
    if (letA !== letB) {
      return letA.localeCompare(letB); // A before B
    }

    // 2. BPM high→low within that key
    const bpmA = a.bpm ?? 0;
    const bpmB = b.bpm ?? 0;
    if (bpmA !== bpmB) {
      return compareAsc(bpmA, bpmB);
    }

    // 3. track name for stability
    const nameA = safeLower(a.track_name);
    const nameB = safeLower(b.track_name);
    return nameA.localeCompare(nameB);
  });
}

// sort newest purchases first
// so stuff you just bought is on top
export function sortByPurchaseDate(rows) {
  return [...rows].sort((a, b) => {
    const pA = tsToMillis(a.purchase_date);
    const pB = tsToMillis(b.purchase_date);

    if (pA !== pB) {
      return compareDesc(pA, pB); // newer first
    }

    // tie-breaker after same purchase timestamp:
    // maybe show higher BPM first (party tracks up top)
    const bpmA = a.bpm ?? 0;
    const bpmB = b.bpm ?? 0;
    if (bpmA !== bpmB) {
      return compareAsc(bpmA, bpmB);
    }

    // final fallback so it's deterministic
    const nameA = safeLower(a.track_name);
    const nameB = safeLower(b.track_name);
    return nameA.localeCompare(nameB);
  });
}

// ----- main dispatcher -----

export function getSortedRows(rows, viewMode) {
  if (!rows) return [];

  switch (viewMode) {
    case "alpha":
      return sortByTrackName(rows);
    case "artists":
      return sortByArtist(rows);
    case "camelot":
      return sortByCamelot(rows);
    case "bought":
      return sortByPurchaseDate(rows);
    default:
      return rows;
  }
}
