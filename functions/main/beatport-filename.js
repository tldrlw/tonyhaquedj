// functions/main/beatport-filename.js
import path from "node:path";

/**
 * Camelot Wheel lookup by normalized key
 */
const keyToCamelot = {
  // Minor keys (A side)
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

  // Major keys (B side)
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

/**
 * 🔤 This function is what makes `Can_t Resist` → `Can't Resist`
 * It finds underscores **between two alphanumeric characters** and replaces them with `'`.
 *
 * ✅ Examples:
 * - `Can_t` → `Can't`
 * - `Don_t` → `Don't`
 * - `I_m` → `I'm`
 */
function restoreApostrophes(s) {
  return s.replace(/([A-Za-z0-9])_([A-Za-z0-9])/g, "$1'$2");
}

/**
 * Additionally, convert underscores that occur at the **end of a word token**
 * into apostrophes. This covers cases like:
 *   - `Let Em_ Know` → `Let Em' Know`
 *   - `California Dreamin_ feat.` → `California Dreamin' feat.`
 *
 * We intentionally do NOT touch a final trailing `_` at end of the whole title
 * until after we check if the title looks like a question (see below).
 */
function restoreWordFinalUnderscores(s) {
  // Replace "_ " or "_," or "_." or "_)" etc. with apostrophe before that separator
  return s.replace(/([A-Za-z0-9])_(?=\s|$|[)\](,.;:!?])/g, "$1'");
}

/**
 * Beatport “unslug”: hyphens → spaces, collapse multiples, clean up parens
 * ✅ This function calls `restoreApostrophes()` first to normalize things like `Can_t` → `Can't`
 */
function unslug(s) {
  const withApos = restoreApostrophes(s); // <-- 🔥 Apostrophe conversion happens here
  let t = withApos
    .replace(/-/g, " ") // dashes → spaces
    .replace(/\s{2,}/g, " ") // collapse multiple spaces
    .replace(/\s+\)/g, ")") // fix spacing before )
    .replace(/\(\s+/g, "(") // fix spacing after (
    .trim();
  try {
    t = t.normalize("NFC");
  } catch {}
  return t;
}

function looksLikeAQuestion(s) {
  return /^(who|what|when|where|why|how|is|are|do|does|did|can|could|will|would)\b/i.test(
    s
  );
}

/**
 * Handle trailing underscores:
 * - If it's a question, replace trailing `_` with `?`
 * - Otherwise, replace trailing `_` with apostrophe `'`
 */
function fixTrailingQuestionMarkOrApostrophe(s) {
  const trimmed = s.trim();
  if (/_+$/.test(trimmed)) {
    return looksLikeAQuestion(trimmed)
      ? trimmed.replace(/_+$/, "?")
      : trimmed.replace(/_+$/, "'");
  }
  return trimmed;
}

/**
 * 🧼 Sanitize extra dashes in filenames.
 * Removes duplicate hyphens (e.g. `---Extended-Mix` → `-Extended-Mix` → then
 * later dashes will become spaces), trims leading/trailing `-`, and logs a warning if cleaning occurred.
 */
function cleanExtraDashes(label, value) {
  const original = value;
  let cleaned = value.replace(/-{2,}/g, "-"); // collapse multiple hyphens to single hyphen
  cleaned = cleaned.replace(/^-+|-+$/g, ""); // remove leading/trailing hyphens
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim(); // collapse extra spaces

  if (cleaned !== original) {
    console.warn(`⚠️ Sanitized ${label}: "${original}" → "${cleaned}"`);
  }
  return cleaned;
}

function toIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(+dt) ? null : dt.toISOString();
}

/**
 * Accept a field that SHOULD contain a date (YYYY-MM-DD). If there are stray
 * characters (e.g., extra dashes attached), we extract the first valid date.
 *
 * Fixes cases like label/purchase boundary oddities:
 *   "Steel-City-Dance-Discs-" + "--" + "2025-10-02"
 *   or accidental whitespace/garbage: "  \u200b2025-10-02"
 */
function toIsoDateLoose(s, fieldName) {
  if (!s) return null;
  const m = String(s).match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) {
    console.warn(`⚠️ ${fieldName}: could not find YYYY-MM-DD in "${s}"`);
    return null;
  }
  const iso = toIsoDate(m[1]);
  if (!iso) console.warn(`⚠️ ${fieldName}: invalid date found in "${s}"`);
  return iso;
}

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

function camelotForKey(normKey) {
  if (!normKey) return null;
  if (keyToCamelot[normKey]) return keyToCamelot[normKey];
  const alt = enharmonicMap[normKey];
  return alt && keyToCamelot[alt] ? keyToCamelot[alt] : null;
}

/**
 * 📁 Beatport filename convention
 * ---------------------------------
 * Beatport downloads follow this structured filename pattern:
 *
 * {track_id}--{track_name}--{artists}--{mix_name}--{bpm}--{key}--{release_year}-{release_month}-{release_day}--{label}--{purchase_year}-{purchase_month}-{purchase_day}.{ext}
 *
 * ✅ Example & Parsing Result:
 * Filename:
 * 17696158--Ain_t-No-Other-Man--Murphy_s-Law-(UK)--Rework---Extended-Mix--128--Gb-Minor--2023-05-19--RCA_Legacy--2025-10-18.aiff
 *
 * Parsed object:
 * - track_id: 17696158
 * - track_name: Ain't No Other Man
 * - artists: Murphy's Law (UK)
 * - mix_name: Rework Extended Mix       ← Dashes converted to spaces
 * - bpm: 128
 * - musical_key: Gb Minor
 * - release_date: 2023-05-19
 * - label: RCA Legacy
 * - purchase_date: 2025-10-18
 *
 * 🧠 Parsing rules & special cases handled automatically:
 * - Extra `--` segments are collapsed, and fields are parsed from the ends inward.
 * - `_` between letters → `'` (e.g. `Can_t Resist` → `Can't Resist`).
 * - Trailing `_` → `?` **only** if the title looks like a question (e.g. `Was-I-Loved_` → `Was I Loved?`).
 * - Word-final underscores → `'` (e.g. `Let Em_ Know` → `Let Em' Know`, `Dreamin_ feat.` → `Dreamin' feat.`).
 * - Multiple consecutive dashes in titles are cleaned (e.g., `Watch-The-Sunrise---Chris-Lake` → `Watch The Sunrise`).
 * - Extra dashes before purchase date no longer break parsing (e.g. `Steel-City-Dance-Discs---2025-10-02.aiff` → `purchase_date: 2025-10-02`).
 */
export function parseBeatportFilename(gcsObjectName) {
  const base = path.basename(gcsObjectName);
  const ext = (path.extname(base) || "").slice(1).toLowerCase();
  const stem = base.slice(0, base.length - (ext ? ext.length + 1 : 0));

  const parts = stem.split("--");
  if (parts.length < 9) {
    return { error: `Expected ≥9 fields, got ${parts.length}`, stem, ext };
  }

  // Pop known fields from the end first (purchase_date, label, release_date, key, bpm)
  const purchaseDateRaw = parts.pop();
  let labelRaw = parts.pop();
  const releaseDateRaw = parts.pop();
  const keyRaw = parts.pop();
  const bpmRaw = parts.pop();
  const trackIdStr = parts.shift(); // track_id is always first

  // Reconstruct the middle part safely (track name, artists, mix name)
  const middle = parts.join("--");
  const midSplit = middle.split("--");
  if (midSplit.length < 3) {
    return { error: "Unable to reconstruct middle fields", stem, ext };
  }

  let trackNameRaw = midSplit[0];
  const artistsRaw = midSplit[1];
  let mixNameRaw = midSplit.slice(2).join("--");

  // 🧼 Clean extra dashes before parsing/unslugging
  trackNameRaw = cleanExtraDashes("track_name", trackNameRaw);
  mixNameRaw = cleanExtraDashes("mix_name", mixNameRaw);
  labelRaw = cleanExtraDashes("label", labelRaw);

  // Normalize everything
  const track_id = Number(trackIdStr);

  // Order matters:
  // 1) unslug (converts hyphens to spaces and restores in-word apostrophes)
  // 2) apply question-or-apostrophe on trailing underscores (title-level)
  // 3) fix *word-final* underscores within the string → apostrophes (Em_, Dreamin_)
  let track_title_pre = unslug(trackNameRaw);
  track_title_pre = fixTrailingQuestionMarkOrApostrophe(track_title_pre);
  const track_name = restoreWordFinalUnderscores(track_title_pre);

  const artists = unslug(artistsRaw);
  const mix_name = restoreWordFinalUnderscores(unslug(mixNameRaw));
  const label = unslug(labelRaw);

  const bpm = /^\d+$/.test(bpmRaw) ? Number(bpmRaw) : null;
  const musical_key = normalizeKey(keyRaw);
  const camelot_key = camelotForKey(musical_key);

  // Be tolerant when extracting the dates (handles extra dashes/strays)
  const release_date = toIsoDateLoose(releaseDateRaw, "release_date");
  const purchase_date = toIsoDateLoose(purchaseDateRaw, "purchase_date");

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
