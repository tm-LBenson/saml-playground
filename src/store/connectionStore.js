const crypto = require("crypto");

class ConnectionStore {
  /**
   * @param {{ ttlMs: number }} options
   */
  constructor({ ttlMs }) {
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  randomId() {
    return "c-" + crypto.randomBytes(4).toString("hex");
  }

  create(conn) {
    const now = Date.now();
    const expiresAtMs = now + this.ttlMs;
    const stored = {
      ...conn,
      id: conn.id || this.randomId(),
      runtime: true,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
    };
    this.map.set(stored.id, stored);
    return stored;
  }

  get(id) {
    if (!id) return null;
    const conn = this.map.get(String(id)) || null;
    if (!conn) return null;
    if (conn.expiresAtMs && conn.expiresAtMs <= Date.now()) {
      this.map.delete(String(id));
      return null;
    }
    return conn;
  }

  delete(id) {
    return this.map.delete(String(id));
  }

  list() {
    const now = Date.now();
    const arr = [];
    for (const conn of this.map.values()) {
      if (conn.expiresAtMs && conn.expiresAtMs <= now) continue;
      arr.push(conn);
    }
    arr.sort((a, b) => String(a.displayName || a.id).localeCompare(String(b.displayName || b.id)));
    return arr;
  }

  cleanup() {
    const now = Date.now();
    for (const [id, conn] of this.map.entries()) {
      if (conn.expiresAtMs && conn.expiresAtMs <= now) this.map.delete(id);
    }
  }
}

module.exports = { ConnectionStore };
