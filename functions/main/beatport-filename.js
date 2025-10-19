// functions/main/beatport-filename.js
import path from "node:path";

/**
 * Camelot Wheel lookup by normalized key:
 * Majors: "C", "F#", "Bb", ...
 * Minors: "Am", "F#m", "Bbm", ...
 * (We prefer flat spellings where Camelot commonly does.)
 */
const keyToCamelot = {
  // Minor (A)
  Abm: "1A",
  Ebm: "2A",
  Bbm: "3A",
  Fm: "4A",
  Cm: "5A",
  Gm: "6A",
  Dm: "7A",
  Am: "8A",
  Em: "9A",
  Bm: "10A",
  "F#m": "11A",
  "C#m": "12A",

  // Major (B)
  B: "1B",
  "F#": "2B",
  Db: "3B",
  Ab: "4B",
  Eb: "5B",
  Bb: "6B",
  F: "7B",
  C: "8B",
  G: "9B",
  D: "10B",
  A: "11B",
  E: "12B",
};

/**
 * Enharmonic equivalents used as a fallback when direct lookup misses.
 * Includes rare/theoretical forms to be bullet-proof.
 */
const enharmonicMap = {
  // Major
  "A#": "Bb",
  "D#": "Eb",
  "G#": "Ab",
  "C#": "Db",
  Db: "C#",
  Gb: "F#",
  Cb: "B",
  Fb: "E",
  "E#": "F",
  "B#": "C",

  // Minor
  "A#m": "Bbm",
  "D#m": "Ebm",
  "G#m": "Abm",
  Dbm: "C#m",
  Gbm: "F#m",
  Cbm: "Bm",
  Fbm: "Em",
  "E#m": "Fm",
  "B#m": "Cm",
};

/** Can_t → Can't (only when _ is between alphanumerics) */
function restoreApostrophes(s) {
  return s.replace(/([A-Za-z0-9])_([A-Za-z0-9])/g, "$1'$2");
}

/** Beatport “unslug”: hyphens→spaces, collapse multiples, fix paren spacing, NFC normalize */
function unslug(s) {
  const withApos = restoreApostrophes(s);
  let t = withApos
    .replace(/-/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s+/g, "(")
    .trim();
  try {
    t = t.normalize("NFC");
  } catch {}
  return t;
}

/** Simple heuristic: is this title likely a question? */
function looksLikeAQuestion(s) {
  return /^(who|what|when|where|why|how|is|are|do|does|did|can|could|will|would)\b/i.test(
    s
  );
}

/**
 * For track titles: only convert a trailing underscore to a “?”
 * if the title appears to be a question.
 */
function fixTrailingQuestionMarkForTitle(s) {
  return looksLikeAQuestion(s) ? s.replace(/_(?=$)/, "?") : s;
}

/** Parse YYYY-MM-DD → ISO string (UTC) */
function toIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(+dt) ? null : dt.toISOString();
}

/**
 * Normalize musical key into:
 *   Majors: "C", "F#", "Bb", ...
 *   Minors: "Am", "F#m", "Bbm", ...
 *
 * Accepts:
 *   - "E-Minor", "C-Major", "Ab Minor", "F#   Major"
 *   - "Em", "C", "Abm", "F#"
 *   - Unicode accidentals (♭/♯) are converted to b/#.
 */
export function normalizeKey(raw) {
  if (!raw) return null;

  const t0 = raw.replace(/_/g, "'").trim();
  const t = t0.replace(/\u266D/g, "b").replace(/\u266F/g, "#");

  let m = t.match(/^([A-Ga-g])\s*(#|b)?\s*[-_\s]*\s*(Major|Minor)$/i);
  if (m) {
    const letter = m[1].toUpperCase();
    const accidental = m[2] || "";
    const qual = m[3].toLowerCase() === "minor" ? "m" : "";
    return `${letter}${accidental}${qual}`;
  }

  m = t.match(/^([A-Ga-g])\s*(#|b)?\s*(m)?$/);
  if (m) {
    const letter = m[1].toUpperCase();
    const accidental = m[2] || "";
    const qual = m[3] ? "m" : "";
    return `${letter}${accidental}${qual}`;
  }

  return t;
}

/** Resolve Camelot code from normalized key, with enharmonic fallback. */
function camelotForKey(normKey) {
  if (!normKey) return null;
  if (keyToCamelot[normKey]) return keyToCamelot[normKey];
  const alt = enharmonicMap[normKey];
  return alt && keyToCamelot[alt] ? keyToCamelot[alt] : null;
}

/**
 * Expected filename template:
 * {track_id}--{track_name}--{artists}--{mix_name}--{bpm}--{key}--{release_date}--{label}--{purchase_date}.{ext}
 */
export function parseBeatportFilename(gcsObjectName) {
  const base = path.basename(gcsObjectName);
  const ext = (path.extname(base) || "").slice(1).toLowerCase();
  const stem = base.slice(0, base.length - (ext ? ext.length + 1 : 0));

  const parts = stem.split("--");
  if (parts.length !== 9) {
    return { error: `Expected 9 fields, got ${parts.length}`, stem, ext };
  }

  const [
    trackIdStr,
    trackNameRaw,
    artistsRaw,
    mixNameRaw,
    bpmRaw,
    keyRaw,
    releaseDateRaw,
    labelRaw,
    purchaseDateRaw,
  ] = parts;

  const track_id = Number(trackIdStr);
  const track_name = fixTrailingQuestionMarkForTitle(unslug(trackNameRaw));
  const artists = unslug(artistsRaw);
  const mix_name = unslug(mixNameRaw);
  const label = unslug(labelRaw);
  const bpm = /^\d+$/.test(bpmRaw) ? Number(bpmRaw) : null;

  const musical_key = normalizeKey(keyRaw);
  const camelot_key = camelotForKey(musical_key);

  const release_date = toIsoDate(releaseDateRaw);
  const purchase_date = toIsoDate(purchaseDateRaw);

  return {
    track_id,
    track_name,
    artists,
    mix_name,
    bpm,
    musical_key,
    camelot_key,
    label,
    release_date,
    purchase_date,
    file_ext: ext,
  };
}
