const path = require("path");
require("dotenv").config();

function env(name, fallback = undefined) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === "") return fallback;
  return v;
}

function boolEnv(name, fallback = false) {
  const v = env(name);
  if (v === undefined) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(String(v).toLowerCase().trim());
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl).replace(/\/+$/, "");
}

function getPort() {
  const p = parseInt(env("PORT", "3000"), 10);
  return Number.isFinite(p) ? p : 3000;
}

function getBaseUrl() {
  const fromEnv = env("BASE_URL");
  if (fromEnv) return normalizeBaseUrl(fromEnv);
  return normalizeBaseUrl(`http://localhost:${getPort()}`);
}

function getSessionSecret() {
  return env("SESSION_SECRET", "dev-secret-change-me");
}

function getTrustProxy() {
  return boolEnv("TRUST_PROXY", false) ? 1 : 0;
}

function getAllowedRelayStateOrigins() {
  const raw = env("ALLOWED_RELAYSTATE_ORIGINS", "");
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeBaseUrl);
  const base = getBaseUrl();
  if (!list.includes(base)) list.push(base);
  return list;
}

function getRuntimeConnectionTtlMs() {
  const hoursRaw = env("RUNTIME_CONNECTION_TTL_HOURS", "12");
  const hours = Number(hoursRaw);
  const h = Number.isFinite(hours) && hours > 0 ? hours : 12;
  return Math.floor(h * 60 * 60 * 1000);
}

module.exports = {
  getPort,
  getBaseUrl,
  getSessionSecret,
  getTrustProxy,
  getAllowedRelayStateOrigins,
  getRuntimeConnectionTtlMs,
};
