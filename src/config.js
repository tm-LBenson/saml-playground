const dotenv = require("dotenv");

dotenv.config();

function env(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).trim();
  if (!trimmed) return fallback;
  return trimmed;
}

function boolEnv(name, fallback) {
  const value = env(name, "");
  if (!value) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

function numEnv(name, fallback) {
  const value = env(name, "");
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function getPort() {
  const p = numEnv("PORT", 3000);
  return Number.isFinite(p) ? p : 3000;
}

function getBaseUrl() {
  const base = env("BASE_URL", "");
  if (!base) return `http://localhost:${getPort()}`;
  return normalizeBaseUrl(base);
}

function getSessionSecret() {
  return env("SESSION_SECRET", "dev-secret-change-me");
}

function getTrustProxy() {
  return boolEnv("TRUST_PROXY", false) ? 1 : 0;
}

function getRuntimeConnectionTtlMs() {
  const hours = numEnv("RUNTIME_CONNECTION_TTL_HOURS", 12);
  const h = Number.isFinite(hours) && hours > 0 ? hours : 12;
  return Math.floor(h * 60 * 60 * 1000);
}

module.exports = {
  getPort,
  getBaseUrl,
  getSessionSecret,
  getTrustProxy,
  getRuntimeConnectionTtlMs,
};
