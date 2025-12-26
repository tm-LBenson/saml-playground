const crypto = require("crypto");
const dotenv = require("dotenv");

dotenv.config();

/** @returns {number} */
function getPort() {
  const raw = process.env.PORT || "3000";
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : 3000;
}

/** @returns {string} */
function getBaseUrl() {
  const env = String(process.env.BASE_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  // Local fallback
  const port = getPort();
  return `http://localhost:${port}`;
}

/** @returns {string} */
function getSessionSecret() {
  const env = String(process.env.SESSION_SECRET || "").trim();
  if (env) return env;
  // Local/dev fallback only
  return crypto.randomBytes(24).toString("hex");
}

/** @returns {boolean|number} */
function getTrustProxy() {
  const v = String(process.env.TRUST_PROXY || "").trim().toLowerCase();
  if (!v) return 0;
  if (v === "true") return 1;
  if (v === "false") return 0;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 1;
}

/** @returns {string[]} */
function getAllowedRelayStateOrigins() {
  const base = getBaseUrl();
  const env = String(process.env.ALLOWED_RELAYSTATE_ORIGINS || "").trim();
  const parts = env
    ? env.split(",").map((s) => s.trim()).filter(Boolean)
    : [base];

  // Normalize (strip trailing slash)
  return parts.map((o) => o.replace(/\/+$/, ""));
}

/** @returns {number} */
function getConnectionTtlMs() {
  const raw = String(process.env.CONNECTION_TTL_MINUTES || "1440").trim();
  const n = Number.parseInt(raw, 10);
  const minutes = Number.isFinite(n) && n > 0 ? n : 1440;
  return minutes * 60 * 1000;
}

module.exports = {
  getPort,
  getBaseUrl,
  getSessionSecret,
  getTrustProxy,
  getAllowedRelayStateOrigins,
  getConnectionTtlMs,
};
