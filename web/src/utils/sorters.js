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
    // 1. artist A→Z
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

// ----- main dispatcher -----

export function getSortedRows(rows, viewMode) {
  if (!rows) return [];

  switch (viewMode) {
    case "alpha":
      return sortByTrackName(rows);
    case "artist":
      return sortByArtist(rows);
    case "camelot":
      return sortByCamelot(rows);
    default:
      return rows;
  }
}
