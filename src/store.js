const crypto = require("crypto");

function createStore({ ttlMs }) {
  const connections = new Map();

  function randomId() {
    return "c-" + crypto.randomBytes(4).toString("hex");
  }

  function createConnection(conn) {
    const now = Date.now();
    const id = randomId();
    const expiresAtMs = now + ttlMs;
    const stored = {
      id,
      label: conn.label || id,
      idpEntityId: conn.idpEntityId,
      idpSsoUrl: conn.idpSsoUrl,
      idpCertPem: conn.idpCertPem,
      metadataNameIdFormat: conn.metadataNameIdFormat || "",
      requestedNameIdFormat: conn.requestedNameIdFormat || "",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
    };
    connections.set(id, stored);
    return stored;
  }

  function getConnection(id) {
    if (!id) return null;
    return connections.get(id) || null;
  }

  function deleteConnection(id) {
    connections.delete(id);
  }

  function listConnections() {
    const items = [...connections.values()];
    items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return items;
  }

  function cleanup() {
    const now = Date.now();
    for (const [id, conn] of connections.entries()) {
      if (conn.expiresAtMs <= now) connections.delete(id);
    }
  }

  return { createConnection, getConnection, deleteConnection, listConnections, cleanup };
}

module.exports = { createStore };
