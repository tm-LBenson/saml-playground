const zlib = require("zlib");
const format = require("xml-formatter");


function decodeSamlRequest(b64) {
  const cleaned = String(b64 || "").trim();
  if (!cleaned) return null;
  const buf = Buffer.from(cleaned, "base64");
  const inflated = zlib.inflateRawSync(buf);
  return inflated.toString("utf8");
}


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
    return xml;
  }
}



function safeRelayStateTo(relayState, allowedBaseUrls = []) {
  if (!relayState) return null;
  const s = String(relayState).trim();
  if (!s) return null;

  if (s.startsWith("/")) return s;

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
