require("dotenv").config();

function getPort() {
  const v = process.env.PORT;
  const n = v ? Number(v) : 3000;
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

function getBaseUrl() {
  const v = String(process.env.BASE_URL || "").trim().replace(/\/+$/, "");
  if (v) return v;
  const port = getPort();
  return `http://localhost:${port}`;
}

function getSessionSecret() {
  const v = String(process.env.SESSION_SECRET || "").trim();
  // For production, always set SESSION_SECRET. For a playground, we fall back so it still runs.
  return v || "dev_secret_change_me";
}

function getTrustProxy() {
  const raw = String(process.env.TRUST_PROXY || "").trim().toLowerCase();
  if (!raw) return 1; // good default for Render/Cloud proxies
  if (raw === "true" || raw === "1") return 1;
  if (raw === "false" || raw === "0") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 1;
}

function getAllowedRelayStateOrigins() {
  const baseUrl = getBaseUrl();
  const defaultOrigin = (() => {
    try {
      return new URL(baseUrl).origin;
    } catch {
      return "";
    }
  })();

  const raw = String(process.env.ALLOWED_RELAYSTATE_ORIGINS || "").trim();
  const list = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const set = new Set([defaultOrigin, ...list].filter(Boolean));
  return [...set];
}

function getRuntimeConnectionTtlMs() {
  const raw = String(process.env.RUNTIME_CONNECTION_TTL_MS || "").trim();
  if (!raw) return 12 * 60 * 60 * 1000; // 12 hours
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 12 * 60 * 60 * 1000;
}

module.exports = {
  getPort,
  getBaseUrl,
  getSessionSecret,
  getTrustProxy,
  getAllowedRelayStateOrigins,
  getRuntimeConnectionTtlMs,
};
