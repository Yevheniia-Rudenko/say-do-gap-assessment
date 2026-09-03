// Zero-dependency Node.js server for the Say-Do Gap Self-Assessment.
// Run with: node server.js
// No npm install needed - uses only Node's built-in http/fs modules.

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { CATEGORIES, SAY_STATEMENTS, DO_ITEMS } = require("./content.js");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "responses.json");
const PUBLIC_DIR = path.join(__dirname, "public");

// Optional shared password for the facilitator dashboard's data endpoints.
// Set FACILITATOR_KEY as an env var before starting the server to require it,
// e.g.  FACILITATOR_KEY=berlin2026 node server.js
const FACILITATOR_KEY = process.env.FACILITATOR_KEY || null;

const VALID_KEYS = Object.keys(CATEGORIES); // ["A".."F"]

// key -> full statement text, for the CSV export (the exact wording the
// participant ranked/selected, not just its category name).
const SAY_TEXT = Object.fromEntries(SAY_STATEMENTS.map((s) => [s.key, s.text]));
const DO_TEXT = Object.fromEntries(DO_ITEMS.map((d) => [d.key, d.text]));

// ---- storage helpers ----------------------------------------------------

function ensureDataFile() {
  if (!fs.existsSync(path.dirname(DATA_FILE))) fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

function readResponses() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function writeResponses(list) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
}

// ---- validation -----------------------------------------------------------

function isValidRanking(ranking) {
  if (!Array.isArray(ranking) || ranking.length !== VALID_KEYS.length) return false;
  const sorted = [...ranking].sort();
  return JSON.stringify(sorted) === JSON.stringify([...VALID_KEYS].sort());
}

function isValidSayAnswers(say) {
  if (!Array.isArray(say)) return false;
  return say.every((k) => VALID_KEYS.includes(k));
}

// ---- small helpers ----------------------------------------------------------

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy(); // basic guard against huge payloads
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function hasFacilitatorAccess(req, parsedUrl) {
  if (!FACILITATOR_KEY) return true;
  const key = parsedUrl.searchParams.get("key") || req.headers["x-facilitator-key"];
  return key === FACILITATOR_KEY;
}

// "2026-09-02T19:07:12.295Z" -> "2026-09-02 19:07:12" (still UTC, just easier
// to read in a spreadsheet than raw ISO-8601 with a T/Z and milliseconds).
function formatTimestamp(iso) {
  return String(iso).replace("T", " ").replace(/\.\d+Z$/, "");
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === "/" ? "/index.html" : urlPath;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(PUBLIC_DIR, filePath);
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

// ---- request handling -------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  try {
    if (pathname === "/api/submit" && req.method === "POST") {
      const body = await readBody(req);
      let parsed;
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        return sendJson(res, 400, { error: "Invalid JSON." });
      }
      const { sayAnswers, doRanking } = parsed;

      if (!isValidSayAnswers(sayAnswers)) return sendJson(res, 400, { error: "Invalid sayAnswers." });
      if (!isValidRanking(doRanking)) return sendJson(res, 400, { error: "Invalid doRanking - must contain all 6 category keys exactly once." });

      const responses = readResponses();
      // No name, email, IP, or device fingerprint is stored - only the SAY
      // selections, the DO ranking, a random id, and a timestamp.
      responses.push({
        id: crypto.randomUUID(),
        submittedAt: new Date().toISOString(),
        sayAnswers,
        doRanking,
      });
      writeResponses(responses);

      const primary = doRanking[0];
      const secondary = doRanking[1];
      return sendJson(res, 200, {
        ok: true,
        primary,
        primaryLabel: CATEGORIES[primary].label,
        secondary,
        secondaryLabel: CATEGORIES[secondary].label,
      });
    }

    if (pathname === "/api/results" && req.method === "GET") {
      if (!hasFacilitatorAccess(req, parsedUrl)) return sendJson(res, 401, { error: "Missing or invalid facilitator key." });

      const responses = readResponses();
      const primaryCounts = {};
      const secondaryCounts = {};
      const sayCounts = {};
      VALID_KEYS.forEach((k) => {
        primaryCounts[k] = 0;
        secondaryCounts[k] = 0;
        sayCounts[k] = 0;
      });

      responses.forEach((r) => {
        primaryCounts[r.doRanking[0]] += 1;
        secondaryCounts[r.doRanking[1]] += 1;
        (r.sayAnswers || []).forEach((k) => (sayCounts[k] += 1));
      });

      // Empty-category rule from the brief: flag categories with 0-1 people
      // ranked #1 so the facilitator can redirect those participants to
      // their own #2 category.
      const lowCategories = VALID_KEYS.filter((k) => primaryCounts[k] <= 1);

      return sendJson(res, 200, {
        totalResponses: responses.length,
        categories: CATEGORIES,
        primaryCounts,
        secondaryCounts,
        sayCounts,
        lowCategories,
        responses: responses.map((r) => ({
          submittedAt: r.submittedAt,
          doRanking: r.doRanking,
          sayAnswers: r.sayAnswers,
        })),
      });
    }

    if (pathname === "/api/export.csv" && req.method === "GET") {
      if (!hasFacilitatorAccess(req, parsedUrl)) return sendJson(res, 401, { error: "Missing or invalid facilitator key." });

      const responses = readResponses();
      // Human-readable header, and the full statement text (not just the A-F
      // key or its short category label), so the file is self-explanatory
      // without the app open next to it.
      const header = [
        "Response #",
        "Submitted (UTC)",
        "1st - most true of me",
        "2nd",
        "3rd",
        "4th",
        "5th",
        "6th - least true of me",
        "SAY statements selected (not scored)",
      ];
      const rows = responses.map((r, i) => {
        const rankTexts = r.doRanking.map((k) => `${CATEGORIES[k].label}: ${DO_TEXT[k]}`);
        // Fixed A-F order rather than click order, so the column reads the
        // same way for every respondent.
        const sayTexts = VALID_KEYS.filter((k) => (r.sayAnswers || []).includes(k))
          .map((k) => `${CATEGORIES[k].label}: ${SAY_TEXT[k]}`)
          .join(" | ");
        return [i + 1, formatTimestamp(r.submittedAt), ...rankTexts, sayTexts];
      });
      const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
      const dateStamp = new Date().toISOString().slice(0, 10);
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=say-do-gap-responses-${dateStamp}.csv`,
      });
      // Leading BOM so Excel (Windows in particular) opens this as UTF-8
      // instead of guessing a legacy codepage and mangling special characters.
      return res.end("\uFEFF" + csv);
    }

    if (pathname === "/api/reset" && req.method === "POST") {
      if (!hasFacilitatorAccess(req, parsedUrl)) return sendJson(res, 401, { error: "Missing or invalid facilitator key." });
      writeResponses([]);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET") {
      return serveStatic(req, res, pathname);
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: "Server error." });
  }
});

server.listen(PORT, () => {
  console.log(`Say-Do Gap app running at http://localhost:${PORT}`);
  console.log(
    `Facilitator dashboard at http://localhost:${PORT}/facilitator.html${FACILITATOR_KEY ? "?key=" + FACILITATOR_KEY : ""}`
  );
});
