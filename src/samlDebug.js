const zlib = require("zlib");

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function extractTag(xml, tag) {
  const re = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "i");
  const m = String(xml || "").match(re);
  return m ? m[1].trim() : "";
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*\\s${attr}="([^"]+)"`, "i");
  const m = String(xml || "").match(re);
  return m ? m[1] : "";
}

function decodeRedirectPayload(value) {
  const raw = String(value || "").trim();
  if (!raw) return { xml: "", mode: "empty" };
  const buf = Buffer.from(raw, "base64");
  const plain = buf.toString("utf8");
  if (plain.trim().startsWith("<")) return { xml: plain, mode: "base64" };
  try {
    const inflated = zlib.inflateRawSync(buf).toString("utf8");
    return { xml: inflated, mode: "deflate+base64" };
  } catch {
    return { xml: plain, mode: "base64-unknown" };
  }
}

function summarizeXml(xml) {
  const text = String(xml || "").trim();
  if (!text) return {};
  const rootMatch = text.match(/^<\??xml[^>]*>\s*<([^\s>:]+:)?([^\s>/]+)/i) || text.match(/^<([^\s>:]+:)?([^\s>/]+)/i);
  const root = rootMatch ? rootMatch[2] : "";
  return {
    root,
    issuer: extractTag(text, "Issuer"),
    destination: extractAttr(text, root || "Response", "Destination") || extractAttr(text, "Response", "Destination") || extractAttr(text, "AuthnRequest", "Destination"),
    assertionConsumerServiceURL: extractAttr(text, "AuthnRequest", "AssertionConsumerServiceURL"),
    protocolBinding: extractAttr(text, "AuthnRequest", "ProtocolBinding"),
    inResponseTo: extractAttr(text, "Response", "InResponseTo"),
    nameId: extractTag(text, "NameID"),
    nameIdFormat: extractAttr(text, "NameID", "Format"),
    statusCode: extractAttr(text, "StatusCode", "Value"),
  };
}

function renderInspectionPage({ title, method, note, binding, xml, details }) {
  const lines = [
    ["HTTP method", method],
    ["Observed binding", binding],
    ["Root element", details.root],
    ["Issuer", details.issuer],
    ["Destination", details.destination],
    ["AssertionConsumerServiceURL", details.assertionConsumerServiceURL],
    ["ProtocolBinding", details.protocolBinding],
    ["InResponseTo", details.inResponseTo],
    ["StatusCode", details.statusCode],
    ["NameID", details.nameId],
    ["NameID Format", details.nameIdFormat],
  ].filter(([, value]) => value);

  const rows = lines
    .map(([k, v]) => `<tr><th style="text-align:left;padding:6px 10px;vertical-align:top;border-bottom:1px solid #ddd;">${xmlEscape(k)}</th><td style="padding:6px 10px;border-bottom:1px solid #ddd;white-space:pre-wrap;word-break:break-word;">${xmlEscape(v)}</td></tr>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${xmlEscape(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px;line-height:1.4;">
  <h1>${xmlEscape(title)}</h1>
  <p>${xmlEscape(note)}</p>
  <table style="border-collapse:collapse;width:100%;max-width:1100px;margin:16px 0;">${rows}</table>
  <h2>Decoded XML</h2>
  <pre style="background:#f6f8fa;border:1px solid #ddd;padding:16px;overflow:auto;white-space:pre-wrap;word-break:break-word;">${xmlEscape(xml || "")}</pre>
</body>
</html>`;
}

module.exports = {
  decodeRedirectPayload,
  summarizeXml,
  renderInspectionPage,
};
