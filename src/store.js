/**
 * In-memory connection store with TTL.
 * Connections are safe to use concurrently (each has its own ID).
 */
function createStore({ ttlMs }) {
  /** @type {Map<string, any>} */
  const connections = new Map();

  function now() {
    return Date.now();
  }

  function cleanup() {
    const t = now();
    for (const [id, c] of connections.entries()) {
      if (c.expiresAtMs && c.expiresAtMs <= t) connections.delete(id);
    }
  }

  function create(conn) {
    cleanup();
    const createdAtMs = now();
    const expiresAtMs = createdAtMs + ttlMs;
    const stored = {
      ...conn,
      createdAt: new Date(createdAtMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
    };
    connections.set(stored.id, stored);
    return stored;
  }

  function get(id) {
    cleanup();
    return connections.get(id) || null;
  }

  function remove(id) {
    return connections.delete(id);
  }

  function list() {
    cleanup();
    const arr = [...connections.values()];
    arr.sort((a, b) => String(a.displayName || a.id).localeCompare(String(b.displayName || b.id)));
    return arr;
  }

  return { create, get, remove, list, cleanup };
}

module.exports = { createStore };
