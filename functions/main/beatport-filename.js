// functions/main/beatport-filename.js
import path from "node:path";

const keyToCamelot = {
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

/** Turn "E-Minor" | "C-Major" → "Em" | "C" */
export function normalizeKey(raw) {
  if (!raw) return null;
  const t = raw.replace(/_/g, "'").trim(); // restore apostrophes if any
  const m = t.match(/^([A-G](?:#|b)?)[-\s_]*(Major|Minor)$/i);
  if (!m) return t;
  const root = m[1].toUpperCase();
  const qual = m[2].toLowerCase() === "minor" ? "m" : "";
  return `${root}${qual}`;
}

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

/** Parse YYYY-MM-DD → ISO string (UTC) */
function toIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(+dt) ? null : dt.toISOString();
}

/** Template:
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
  const track_name = unslug(trackNameRaw);
  const artists = unslug(artistsRaw);
  const mix_name = unslug(mixNameRaw);
  const label = unslug(labelRaw);
  const bpm = /^\d+$/.test(bpmRaw) ? Number(bpmRaw) : null;
  const musical_key = normalizeKey(keyRaw);
  const camelot_key = keyToCamelot[musical_key] || null;
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
