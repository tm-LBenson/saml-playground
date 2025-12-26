const { layout, esc } = require("./layout");

function field({ id, label, value, help }) {
  const h = help ? `<span class="help" title="${esc(help)}">?</span>` : "";
  return `<div class="kv-item">
    <div class="label">${esc(label)} ${h}</div>
    <div class="row">
      <input class="input mono" id="${esc(id)}" value="${esc(value)}" readonly>
      <button class="btn" type="button" onclick="copyText('${esc(id)}')">Copy</button>
    </div>
  </div>`;
}

function renderHome({ baseUrl, connections, user }) {
  const items = (connections || [])
    .map((c) => {
      const name = esc(c.displayName || c.id);
      return `<div class="card">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-weight:700">${name}</div>
          <div class="small mono">${esc(c.id)}</div>
        </div>
        <div class="row" style="flex-wrap:wrap;justify-content:flex-end">
          <a class="btn" href="/c/${encodeURIComponent(c.id)}">Details</a>
          <a class="btn" href="/login/${encodeURIComponent(c.id)}">SP login</a>
          <a class="btn" href="/launch/${encodeURIComponent(c.id)}" title="Tile-friendly launch">Launch</a>
        </div>
      </div>
    </div>`;
    })
    .join("");

  const sessionBox = user
    ? `<div class="card"><div class="row" style="justify-content:space-between">
        <div><div style="font-weight:700">Signed in</div><div class="small mono">${esc(user.nameID || user.id)}</div></div>
        <a class="btn" href="/me">View</a>
      </div></div>`
    : `<div class="card"><div class="row" style="justify-content:space-between">
        <div><div style="font-weight:700">Not signed in</div><div class="small">Import metadata to create a connection.</div></div>
        <a class="btn btn-primary" href="/import">Import</a>
      </div></div>`;

  const body = `<h1>Connections</h1>
  ${sessionBox}
  ${items || `<div class="card"><div class="small">No connections yet.</div></div>`}`;

  return layout({ title: "SAML Playground", body, activePath: "/" });
}

function renderImport({ baseUrl, error, values }) {
  const v = values || {};
  const err = error
    ? `<div class="card err"><div style="font-weight:700">Import failed</div><div class="small mono">${esc(error)}</div></div>`
    : "";

  const body = `${err}
  <div class="card">
    <h1>Import IdP metadata</h1>
    <div class="small">Provide a metadata URL or paste metadata XML.</div>
    <hr>
    <form method="post" action="/import">
      <div class="grid grid-2">
        <div>
          <div class="label">Display name <span class="help" title="Optional label shown on the home page">?</span></div>
          <input class="input" name="displayName" value="${esc(v.displayName || "")}">
        </div>
        <div>
          <div class="label">NameID format <span class="help" title="Default is emailAddress">?</span></div>
          <input class="input mono" name="nameIdFormat" value="${esc(
            v.nameIdFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
          )}">
        </div>
      </div>

      <div style="margin-top:12px">
        <div class="label">Metadata URL <span class="help" title="Example: https://tenant/idp/profile/Metadata/SAML">?</span></div>
        <input class="input mono" name="metadataUrl" value="${esc(v.metadataUrl || "")}">
      </div>

      <div style="margin-top:12px">
        <div class="label">Metadata XML <span class="help" title="Paste the IdP metadata XML here">?</span></div>
        <textarea class="mono" name="metadataXml">${esc(v.metadataXml || "")}</textarea>
      </div>

      <div style="margin-top:12px" class="row">
        <label class="row" style="gap:8px">
          <input type="checkbox" name="allowIdpInitiated" ${v.allowIdpInitiated ? "checked" : ""}>
          <span class="small">Allow IdP-initiated launch</span>
        </label>
      </div>

      <div style="margin-top:14px" class="row">
        <button class="btn btn-primary" type="submit">Create connection</button>
        <a class="btn" href="/">Cancel</a>
      </div>
    </form>
  </div>`;

  return layout({ title: "Import", body, activePath: "/import" });
}

function renderConnection({ baseUrl, conn, urls }) {
  const c = conn;
  const u = urls;

  const body = `<div class="card">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div>
        <h1 style="margin:0">Connection</h1>
        <div class="small mono">${esc(c.id)}</div>
      </div>
      <form method="post" action="/c/${encodeURIComponent(c.id)}/delete">
        <button class="btn" type="submit">Delete</button>
      </form>
    </div>
  </div>

  <div class="card">
    <h2>SP values</h2>
    <div class="kv">
      ${field({
        id: "sp_entity",
        label: "SP Entity ID (Issuer, Audience)",
        value: u.spEntityId,
        help: "Use this as the SP entityID in the IdP partner config",
      })}
      ${field({ id: "sp_acs", label: "ACS URL", value: u.acsUrl, help: "IdP posts the SAMLResponse to this URL" })}
      ${field({
        id: "sp_meta",
        label: "SP metadata URL",
        value: u.spMetadataUrl,
        help: "Paste this metadata into the IdP if it supports metadata import",
      })}
      ${field({
        id: "sp_login",
        label: "SP-initiated login URL",
        value: u.spLoginUrl,
        help: "Starts the SAML flow from the service provider",
      })}
    </div>
  </div>

  <div class="card">
    <h2>IdP-initiated</h2>
    <div class="kv">
      ${field({
        id: "tile_url",
        label: "Tile-friendly launch URL",
        value: u.tileUrl,
        help: "Use this in the portal tile. No query string.",
      })}
      ${field({
        id: "idp_direct",
        label: "Direct IdP-initiated URL",
        value: u.idpInitiatedUrl,
        help: "For browser testing. Some portals strip query strings.",
      })}
    </div>
  </div>

  <div class="card">
    <h2>IdP values</h2>
    <div class="kv">
      ${field({ id: "idp_entity", label: "IdP entity ID", value: c.idpEntityId, help: "Issuer of the IdP" })}
      ${field({ id: "idp_sso", label: "IdP SSO URL", value: c.idpSsoUrl, help: "EntryPoint used for SP-initiated login" })}
    </div>
  </div>

  <div class="card">
    <a class="btn" href="/">Back</a>
  </div>`;

  return layout({ title: "Connection", body, activePath: "" });
}

function renderMe({ baseUrl, user, nowIso }) {
  const u = user;
  const body = u
    ? `<div class="card">
        <h1>Session</h1>
        <div class="kv">
          <div class="kv-item"><div class="label">Now</div><div class="mono">${esc(nowIso)}</div></div>
          <div class="kv-item"><div class="label">Connection</div><div class="mono">${esc(u.connectionId || "")}</div></div>
          <div class="kv-item"><div class="label">NameID</div><div class="mono">${esc(u.nameID || "")}</div></div>
          <div class="kv-item"><div class="label">NameIDFormat</div><div class="mono">${esc(u.nameIDFormat || "")}</div></div>
          <div class="kv-item"><div class="label">SessionIndex</div><div class="mono">${esc(u.sessionIndex || "")}</div></div>
          <div class="kv-item"><div class="label">Logged in at</div><div class="mono">${esc(u.loggedInAt || "")}</div></div>
        </div>
      </div>
      <div class="card">
        <h2>Profile</h2>
        <pre class="mono">${esc(JSON.stringify(u.profile || {}, null, 2))}</pre>
      </div>
      <div class="card">
        <a class="btn" href="/">Home</a>
      </div>`
    : `<div class="card">
        <h1>Me</h1>
        <div class="small">Not signed in.</div>
        <div style="margin-top:12px" class="row">
          <a class="btn btn-primary" href="/import">Import</a>
          <a class="btn" href="/">Home</a>
        </div>
      </div>`;

  return layout({ title: "Me", body, activePath: "/me" });
}

function renderError({ baseUrl, title, message, details }) {
  const body = `<div class="card err">
    <h1>${esc(title || "Error")}</h1>
    <div class="small">${esc(message || "")}</div>
    ${details ? `<hr><pre class="mono">${esc(details)}</pre>` : ""}
    <div style="margin-top:14px" class="row">
      <a class="btn" href="/">Home</a>
      <a class="btn" href="/import">Import</a>
    </div>
  </div>`;
  return layout({ title: "Error", body, activePath: "" });
}

module.exports = { renderHome, renderImport, renderConnection, renderMe, renderError };
