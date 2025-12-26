function safeRelayStateTo(relayState, allowedOrigins) {
  if (!relayState) return null;
  const s = String(relayState || "").trim();
  if (!s) return null;

  // Allow relative paths
  if (s.startsWith("/")) return s;

  // Allow absolute URLs only if origin is explicitly allowed
  try {
    const u = new URL(s);
    const ok = Array.isArray(allowedOrigins) && allowedOrigins.includes(u.origin);
    if (!ok) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

module.exports = { safeRelayStateTo };
