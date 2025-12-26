const { layout, esc } = require("./layout");
const { buildIdpInitiatedUrl } = require("../urls");

function formatDate(s) {
  if (!s) return "";
  try {
    return new Date(s).toISOString();
  } catch {
    return String(s);
  }
}

function renderHome({ baseUrl, connections, user }) {
  const cards =
    connections && connections.length
      ? connections
          .map((c) => {
            const expires = c.expiresAt
              ? `<span class="pill">expires ${esc(
                  formatDate(c.expiresAt),
                )}</span>`
              : "";
            const created = c.createdAt
              ? `<span class="pill">created ${esc(
                  formatDate(c.createdAt),
                )}</span>`
              : "";
            return `<div class="card">
  <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap">
    <div>
      <div style="font-weight:800; font-size:16px">${esc(
        c.displayName || c.id,
      )}</div>
      <div class="small mono" style="margin-top:4px">${esc(c.id)}</div>
      <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap">${created}${expires}</div>
    </div>
    <div class="btnRow">
      <a class="btn" href="/c/${encodeURIComponent(c.id)}">Open</a>
      <a class="btn" href="/login/${encodeURIComponent(c.id)}">SP login</a>
      ${
        c.allowIdpInitiated
          ? `<a class="btn" href="/launch/${encodeURIComponent(
              c.id,
            )}">Tile launch</a>`
          : ""
      }
    </div>
  </div>
</div>`;
          })
          .join("\n")
      : `<div class="card"><div class="small">No connections yet. Use <a href="/import">Import</a> to create one.</div></div>`;

  const sessionCard = user
    ? `<div class="card">
  <div style="font-weight:800">Signed in</div>
  <div class="small mono" style="margin-top:8px">${esc(user.id)}</div>
</div>`
    : "";

  return layout({
    baseUrl,
    title: "Home",
    active: "home",
    content: `${sessionCard}${cards}`,
  });
}

function renderMe({ baseUrl, user, nowIso }) {
  const content = user
    ? `<div class="card">
  <h1>Session</h1>
  <div class="small" style="margin-top:6px">Now: <span class="mono">${esc(
    nowIso,
  )}</span></div>
  <hr>
  <div class="grid">
    <div><div class="label">Connection</div><div class="mono" style="margin-top:6px">${esc(
      user.connectionId || "",
    )}</div></div>
    <div><div class="label">NameID</div><div class="mono" style="margin-top:6px">${esc(
      user.nameID || "",
    )}</div></div>
    <div><div class="label">NameIDFormat</div><div class="mono" style="margin-top:6px">${esc(
      user.nameIDFormat || "",
    )}</div></div>
    <div><div class="label">SessionIndex</div><div class="mono" style="margin-top:6px">${esc(
      user.sessionIndex || "",
    )}</div></div>
  </div>
</div>

<div class="card">
  <h2>Profile</h2>
  <div class="small" style="margin-bottom:10px">Raw SAML profile as parsed by the library.</div>
  <pre class="mono">${esc(JSON.stringify(user.profile || {}, null, 2))}</pre>
</div>`
    : `<div class="card"><div style="font-weight:800">Not signed in</div><div class="small" style="margin-top:8px">Use a connection to run SP-initiated or IdP-initiated login.</div></div>`;

  return layout({
    baseUrl,
    title: "Me",
    active: "me",
    content,
  });
}

function renderError({ baseUrl, title, message, details }) {
  const body = `<div class="card err">
  <h1>${esc(title || "Error")}</h1>
  <div class="small" style="margin-top:8px">${esc(message || "")}</div>
  ${
    details
      ? `<pre class="mono" style="margin-top:12px">${esc(details)}</pre>`
      : ""
  }
  <div class="btnRow" style="margin-top:14px">
    <a class="btn" href="/">Home</a>
    <a class="btn" href="/import">Import</a>
  </div>
</div>`;

  return layout({
    baseUrl,
    title: "Error",
    active: "",
    content: body,
  });
}

function renderImport({ baseUrl, error, values }) {
  const v = values || {};
  const err = error
    ? `<div class="card err"><div style="font-weight:700">Import failed</div><div class="small mono" style="margin-top:6px">${esc(
        error,
      )}</div></div>`
    : "";

  const defaultMode = v.metadataSource === "xml" ? "xml" : "url";
  const nameIdValue = esc(v.nameIdFormat || "");

  const isUrl = defaultMode === "url";
  const isXml = defaultMode === "xml";

  const body = `${err}
  <div class="card">
    <h1>Import connection</h1>
    <div class="small" style="margin-top:6px">Paste IdP metadata to create a temporary connection.</div>
    <hr>

    <form method="post" action="/import" data-import-form>
      <div class="label">Metadata input</div>
      <div class="small" style="margin-top:6px">Choose how you want to provide IdP metadata.</div>

      <div class="radioRow" style="margin-top:10px">
        <label class="radio">
          <input type="radio" name="metadataSource" value="url" ${
            isUrl ? "checked" : ""
          }>
          <span>URL</span>
        </label>
        <label class="radio">
          <input type="radio" name="metadataSource" value="xml" ${
            isXml ? "checked" : ""
          }>
          <span>XML</span>
        </label>
      </div>

      <div id="wrap_url" style="margin-top:14px; ${
        isUrl ? "" : "display:none"
      }">
        <div class="label">Metadata URL <span class="help" title="The IdP metadata URL. In RapidIdentity this is the Live Metadata URL.">?</span></div>
        <div class="small" style="margin-top:6px">Example: <span class="mono">https://tenant/idp/profile/Metadata/SAML</span></div>
        <input id="metadataUrl" class="input mono" name="metadataUrl" value="${esc(
          v.metadataUrl || "",
        )}" placeholder="https://.../idp/profile/Metadata/SAML" ${
    isUrl ? "required" : "disabled"
  }>
      </div>

      <div id="wrap_xml" style="margin-top:14px; ${
        isXml ? "" : "display:none"
      }">
        <div class="label">Metadata XML <span class="help" title="Paste the full IdP metadata XML (EntityDescriptor).">?</span></div>
        <div class="small" style="margin-top:6px">Paste the full <span class="mono">&lt;EntityDescriptor&gt;</span> document.</div>
        <textarea id="metadataXml" class="mono" name="metadataXml" placeholder="&lt;EntityDescriptor ...&gt;" ${
          isXml ? "required" : "disabled"
        }>${esc(v.metadataXml || "")}</textarea>
      </div>

      <div class="grid grid-2" style="margin-top:16px">
        <div>
          <div class="label">Display name <span class="help" title="Optional label shown in the UI.">?</span></div>
          <div class="small" style="margin-top:6px">Optional.</div>
          <input class="input" name="displayName" value="${esc(
            v.displayName || "",
          )}" placeholder="e.g., RI Test Tenant">
        </div>

        <div>
          <div class="label">Requested NameID format <span class="help" title="Optional. Leave blank to avoid forcing a NameIDPolicy in the AuthnRequest.">?</span></div>
          <div class="small" style="margin-top:6px">Optional. Leave blank unless you need to force a specific format.</div>
          <input class="input mono" name="nameIdFormat" value="${nameIdValue}" placeholder="(leave blank)" list="nameid-formats">
          <datalist id="nameid-formats">
            <option value="urn:oasis:names:tc:SAML:2.0:nameid-format:transient"></option>
            <option value="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"></option>
            <option value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"></option>
            <option value="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified"></option>
          </datalist>
        </div>

        <div style="grid-column:1 / -1">
          <label class="check">
            <input type="checkbox" name="allowIdpInitiated" ${
              v.allowIdpInitiated ? "checked" : ""
            }>
            Allow IdP-initiated (unsolicited)
          </label>
          <div class="small" style="margin-top:6px">Recommended for tile testing.</div>
        </div>
      </div>

      <div style="margin-top:18px; display:flex; gap:10px; align-items:center">
        <button class="btn primary" type="submit">Create connection</button>
        <a class="btn" href="/">Cancel</a>
      </div>
    </form>
  </div>`;

  return layout({
    baseUrl,
    title: "Import",
    active: "import",
    content: body,
  });
}

function renderConnection({ baseUrl, conn }) {
  const spEntityId = `${baseUrl}/saml/metadata/${encodeURIComponent(conn.id)}`;
  const acsUrl = `${baseUrl}/saml/acs/${encodeURIComponent(conn.id)}`;
  const metadataUrl = spEntityId;
  const spLogin = `${baseUrl}/login/${encodeURIComponent(conn.id)}`;
  const tileLaunch = `${baseUrl}/launch/${encodeURIComponent(conn.id)}`;

  const idpInit = buildIdpInitiatedUrl({
    idpEntityId: conn.idpEntityId,
    spEntityId,
    target: `${baseUrl}/me`,
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${spEntityId}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
      AuthnRequestsSigned="false" WantAssertionsSigned="true">
${
  conn.nameIdFormat
    ? `    <NameIDFormat>${conn.nameIdFormat}</NameIDFormat>\n`
    : ""
}    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}" index="1" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;

  const body = `<div class="card">
  <h1>Connection</h1>
  <div class="small" style="margin-top:6px">${esc(
    conn.displayName || conn.id,
  )}</div>
  <div class="small mono" style="margin-top:6px">${esc(conn.id)}</div>
  <hr>

  <h2>SP values</h2>
  <div class="grid">
    <div>
      <div class="label">SP Entity ID</div>
      <input class="input mono" readonly value="${esc(spEntityId)}">
    </div>
    <div>
      <div class="label">ACS URL</div>
      <input class="input mono" readonly value="${esc(acsUrl)}">
    </div>
    <div>
      <div class="label">SP metadata URL</div>
      <input class="input mono" readonly value="${esc(metadataUrl)}">
    </div>
    <div class="btnRow">
      <a class="btn" href="${spLogin}">SP-initiated login</a>
      ${
        conn.allowIdpInitiated
          ? `<a class="btn" href="${tileLaunch}">Tile launch (recommended)</a>`
          : ""
      }
      ${
        conn.allowIdpInitiated
          ? `<a class="btn" href="${idpInit}">IdP-initiated URL (direct)</a>`
          : ""
      }
    </div>
    <details>
      <summary>Show SP metadata XML</summary>
      <pre class="mono">${esc(xml)}</pre>
    </details>
  </div>

  <hr>
  <h2>IdP values</h2>
  <div class="grid grid-2">
    <div>
      <div class="label">IdP Entity ID</div>
      <input class="input mono" readonly value="${esc(conn.idpEntityId)}">
    </div>
    <div>
      <div class="label">IdP SSO URL</div>
      <input class="input mono" readonly value="${esc(conn.idpSsoUrl)}">
    </div>
  </div>

  <div style="margin-top:18px">
    <form method="post" action="/c/${encodeURIComponent(
      conn.id,
    )}/delete" onsubmit="return confirm('Delete this connection?')">
      <button class="btn" type="submit">Delete connection</button>
    </form>
  </div>
</div>`;

  return layout({
    baseUrl,
    title: "Connection",
    active: "",
    content: body,
  });
}

module.exports = {
  renderHome,
  renderMe,
  renderError,
  renderImport,
  renderConnection,
};
