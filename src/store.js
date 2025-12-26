const crypto = require("crypto");

function createStore(ttlMs) {
  const connections = new Map();

  function randomId() {
    return "c-" + crypto.randomBytes(4).toString("hex");
  }

  function put(conn) {
    const now = Date.now();
    const expiresAtMs = now + ttlMs;
    const stored = {
      ...conn,
      id: conn.id || randomId(),
      runtime: true,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
    };
    connections.set(stored.id, stored);
    return stored;
  }

  function get(id) {
    if (!id) return null;
    return connections.get(id) || null;
  }

  function del(id) {
    connections.delete(id);
  }

  function all() {
    const arr = [...connections.values()];
    arr.sort((a, b) => String(a.displayName || a.id).localeCompare(String(b.displayName || b.id)));
    return arr;
  }

  function cleanup() {
    const now = Date.now();
    for (const [id, conn] of connections.entries()) {
      if (conn.expiresAtMs && conn.expiresAtMs <= now) {
        connections.delete(id);
      }
    }
  }

  return { put, get, del, all, cleanup };
}

module.exports = { createStore };
