function safeRelayStateTo(relayState, allowedOrigins) {
  const v = String(relayState || "").trim();
  if (!v) return null;
  if (v.startsWith("/")) return v;
  try {
    const u = new URL(v);
    const origin = `${u.protocol}//${u.host}`;
    if (!allowedOrigins.includes(origin)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

module.exports = { safeRelayStateTo };
