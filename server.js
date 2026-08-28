// Zero-dependency Node.js server for the Say-Do Gap Self-Assessment.
// Run with: node server.js
// No npm install needed - uses only Node's built-in http/fs modules.

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { CATEGORIES } = require("./content.js");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "responses.json");
const PUBLIC_DIR = path.join(__dirname, "public");

// Optional shared password for the facilitator dashboard's data endpoints.
// Set FACILITATOR_KEY as an env var before starting the server to require it,
// e.g.  FACILITATOR_KEY=berlin2026 node server.js
const FACILITATOR_KEY = process.env.FACILITATOR_KEY || null;

const VALID_KEYS = Object.keys(CATEGORIES); // ["A".."F"]

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
      const header = ["submittedAt", "rank1", "rank2", "rank3", "rank4", "rank5", "rank6", "sayAnswers"];
      const rows = responses.map((r) => [r.submittedAt, ...r.doRanking, (r.sayAnswers || []).join("|")]);
      const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      res.writeHead(200, {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=say-do-gap-responses.csv",
      });
      return res.end(csv);
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
