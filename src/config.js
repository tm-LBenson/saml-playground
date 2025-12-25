const fs = require("fs");
const path = require("path");
require("dotenv").config();

function env(name, fallback = undefined) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === "") {
    return fallback;
  }
  return v;
}

function boolEnv(name, fallback = false) {
  const v = env(name);
  if (v === undefined) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(String(v).toLowerCase().trim());
}

function normalizeBaseUrl(baseUrl) {
  // Remove trailing slash.
  return String(baseUrl).replace(/\/+$/, "");
}

function getPort() {
  const p = parseInt(env("PORT", "3000"), 10);
  return Number.isFinite(p) ? p : 3000;
}

function getBaseUrl() {
  const fromEnv = env("BASE_URL");
  if (fromEnv) return normalizeBaseUrl(fromEnv);
  // Fallback for local dev (NOTE: most IdPs require HTTPS; use a tunnel like ngrok).
  return normalizeBaseUrl(`http://localhost:${getPort()}`);
}

function getSessionSecret() {
  return env("SESSION_SECRET", "dev-secret-change-me");
}

function getConnectionsFile() {
  const f = env("CONNECTIONS_FILE", "./connections.json");
  // Resolve relative to project root
  return path.isAbsolute(f) ? f : path.join(process.cwd(), f);
}

function getTrustProxy() {
  // 0 means disabled in Express; otherwise trust 1 hop.
  return boolEnv("TRUST_PROXY", false) ? 1 : 0;
}

function getAllowedRelayStateOrigins() {
  const raw = env("ALLOWED_RELAYSTATE_ORIGINS", "");
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeBaseUrl);
  // Always allow BASE_URL (same-origin).
  const base = getBaseUrl();
  if (!list.includes(base)) list.push(base);
  return list;
}

function validateConnection(conn) {
  const required = ["id", "displayName", "idpSsoUrl", "idpCertPem"];
  const missing = required.filter((k) => !conn[k] || String(conn[k]).trim() === "");
  if (missing.length) {
    throw new Error(`Connection "${conn.id || "(missing id)"}" is missing: ${missing.join(", ")}`);
  }
  return {
    id: String(conn.id).trim(),
    displayName: String(conn.displayName).trim(),
    idpEntityId: conn.idpEntityId ? String(conn.idpEntityId).trim() : undefined,
    idpSsoUrl: String(conn.idpSsoUrl).trim(),
    idpCertPem: String(conn.idpCertPem).trim(),
    nameIdFormat: conn.nameIdFormat
      ? String(conn.nameIdFormat).trim()
      : "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    allowIdpInitiated: Boolean(conn.allowIdpInitiated),
  };
}

function loadConnections() {
  const file = getConnectionsFile();
  if (!fs.existsSync(file)) {
    const hint = `Connections file not found at ${file}\n` +
      `Create one by copying connections.example.json to connections.json.\n`;
    throw new Error(hint);
  }

  const raw = fs.readFileSync(file, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to parse JSON in ${file}: ${e.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Connections file ${file} must contain a JSON array.`);
  }

  const map = new Map();
  for (const c of parsed) {
    const normalized = validateConnection(c);
    if (map.has(normalized.id)) {
      throw new Error(`Duplicate connection id "${normalized.id}" in ${file}`);
    }
    map.set(normalized.id, normalized);
  }
  return map;
}

module.exports = {
  getPort,
  getBaseUrl,
  getSessionSecret,
  getConnectionsFile,
  getTrustProxy,
  getAllowedRelayStateOrigins,
  loadConnections,
};
