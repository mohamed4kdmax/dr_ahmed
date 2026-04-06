const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const SYNC_KEYS = [
  "clinic_registered_users",
  "clinic_patients_v1",
  "clinic_extra_admins",
  "clinic_support_chats_v1",
  "clinic_appointments_v1",
  "clinic_appointments_archive_v1"
];

function ensureStateFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    const initial = {
      updatedAt: Date.now(),
      state: {}
    };
    SYNC_KEYS.forEach((k) => {
      initial.state[k] = null;
    });
    fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

function readState() {
  ensureStateFile();
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("invalid state");
    if (!parsed.state || typeof parsed.state !== "object") parsed.state = {};
    SYNC_KEYS.forEach((k) => {
      if (typeof parsed.state[k] === "undefined") parsed.state[k] = null;
    });
    return parsed;
  } catch (err) {
    return {
      updatedAt: Date.now(),
      state: Object.fromEntries(SYNC_KEYS.map((k) => [k, null]))
    };
  }
}

function sanitizeIncomingState(input) {
  const out = {};
  SYNC_KEYS.forEach((k) => {
    out[k] = Object.prototype.hasOwnProperty.call(input, k) ? input[k] : null;
  });
  return out;
}

function writeState(stateObj) {
  ensureStateFile();
  fs.writeFileSync(STATE_FILE, JSON.stringify(stateObj, null, 2), "utf8");
}

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.get("/api/state", (_req, res) => {
  res.json(readState());
});

app.put("/api/state", (req, res) => {
  const incoming = req.body && req.body.state;
  if (!incoming || typeof incoming !== "object") {
    return res.status(400).json({ ok: false, error: "Invalid payload. Expected { state: {...} }" });
  }
  const next = {
    updatedAt: Date.now(),
    state: sanitizeIncomingState(incoming)
  };
  writeState(next);
  return res.json({ ok: true, updatedAt: next.updatedAt });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "ftkdo.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`FTK clinic server running on http://${HOST}:${PORT}`);
});
