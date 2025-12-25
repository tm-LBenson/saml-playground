const zlib = require("zlib");
const format = require("xml-formatter");

/**
 * Decode SAMLRequest (HTTP-Redirect binding): base64 + DEFLATE (raw) + UTF-8 XML
 */
function decodeSamlRequest(b64) {
  const cleaned = String(b64 || "").trim();
  if (!cleaned) return null;
  const buf = Buffer.from(cleaned, "base64");
  const inflated = zlib.inflateRawSync(buf);
  return inflated.toString("utf8");
}

/**
 * Decode SAMLResponse (usually HTTP-POST binding): base64 + UTF-8 XML
 */
function decodeSamlResponse(b64) {
  const cleaned = String(b64 || "").replace(/\s+/g, "");
  if (!cleaned) return null;
  const buf = Buffer.from(cleaned, "base64");
  return buf.toString("utf8");
}

function formatXml(xml) {
  if (!xml) return null;
  try {
    return format(xml, {
      indentation: "  ",
      collapseContent: true,
      lineSeparator: "\n",
    });
  } catch (e) {
    // If formatting fails, return raw xml for troubleshooting.
    return xml;
  }
}

/**
 * Accept RelayState safely.
 * - Always allow relative paths like "/me" or "/deep/link?x=1"
 * - Allow full URLs only if they match an allowlist of origins
 *
 * Returns a path (string) or null.
 */
function safeRelayStateTo(relayState, allowedBaseUrls = []) {
  if (!relayState) return null;
  const s = String(relayState).trim();
  if (!s) return null;

  // Relative path (preferred)
  if (s.startsWith("/")) return s;

  // Full URL: only allow same-origin (or allowlisted origins)
  try {
    const u = new URL(s);
    const allowedOrigins = allowedBaseUrls
      .map((x) => {
        try {
          return new URL(String(x)).origin;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (allowedOrigins.includes(u.origin)) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    // ignore
  }
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  decodeSamlRequest,
  decodeSamlResponse,
  formatXml,
  safeRelayStateTo,
  escapeHtml,
};
