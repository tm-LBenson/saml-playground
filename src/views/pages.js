const { layout, esc } = require("./layout");

function renderError({ title, message, details }) {
  const body = `<div class="card err">
  <h1>${esc(title)}</h1>
  <div class="small">${esc(message)}</div>
  ${details ? `<details open><summary>Details</summary><pre class="mono">${esc(details)}</pre></details>` : ""}
  <div class="btnRow" style="margin-top:14px">
    <a class="btn primary" href="/">Home</a>
    <a class="btn" href="/import">Import</a>
  </div>
</div>`;
  return layout({ title, active: "", content: body });
}

function renderHome({ connections, user }) {
  const session = user
    ? `<div class="card">
  <h2>Session</h2>
  <div class="small mono">${esc(user.connectionId || "")}</div>
  <div class="small mono">${esc(user.nameID || "")}</div>
</div>`
    : "";

  const list = connections.length
    ? connections
        .map((c) => {
          const id = encodeURIComponent(c.id);
          return `<div class="card">
  <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap">
    <div class="kv">
      <div style="font-weight:800">${esc(c.label)}</div>
      <div class="small mono">${esc(c.id)}</div>
      <div class="small">Expires: <span class="mono">${esc(c.expiresAt)}</span></div>
    </div>
    <div class="btnRow">
      <a class="btn" href="/c/${id}">Open</a>
      <a class="btn" href="/login/${id}">SP login</a>
      <a class="btn" href="/launch/${id}">Tile launch</a>
    </div>
  </div>
</div>`;
        })
        .join("")
    : `<div class="card"><div class="small">No connections yet.</div><div style="margin-top:10px"><a class="btn primary" href="/import">Import</a></div></div>`;

  return layout({ title: "Home", active: "home", content: session + list });
}

function renderImport({ error, values }) {
  const v = values || {};
  const err = error
    ? `<div class="card err"><div style="font-weight:800">Import failed</div><div class="small mono" style="margin-top:8px">${esc(error)}</div></div>`
    : "";

  const mode = v.metadataSource === "xml" ? "xml" : "url";

  const body = `${err}
<div class="card">
  <h1>Import</h1>
  <div class="small">Provide IdP metadata to create a temporary connection.</div>
  <hr style="border:0;border-top:1px solid #e5e7eb;margin:14px 0">

  <form method="post" action="/import" data-import-form>
    <div class="label">Metadata source</div>
    <div class="radioRow" style="margin-top:10px">
      <label class="radio"><input type="radio" name="metadataSource" value="url" ${mode === "url" ? "checked" : ""}>URL</label>
      <label class="radio"><input type="radio" name="metadataSource" value="xml" ${mode === "xml" ? "checked" : ""}>XML</label>
    </div>

    <div id="wrap_url" style="margin-top:14px">
      <div class="label">Metadata URL</div>
      <input id="metadataUrl" class="input mono" name="metadataUrl" value="${esc(v.metadataUrl || "")}" placeholder="https://tenant.example.com/idp/profile/Metadata/SAML">
    </div>

    <div id="wrap_xml" style="margin-top:14px; display:none">
      <div class="label">Metadata XML</div>
      <textarea id="metadataXml" class="mono" name="metadataXml" placeholder="<EntityDescriptor ...>">${esc(v.metadataXml || "")}</textarea>
    </div>

    <div class="grid grid-2" style="margin-top:16px">
      <div>
        <div class="label">Label</div>
        <input class="input" name="label" value="${esc(v.label || "")}" placeholder="Test connection">
      </div>
      <div>
        <div class="label">SP metadata NameIDFormat</div>
        <input class="input mono" name="metadataNameIdFormat" value="${esc(v.metadataNameIdFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress")}" list="nameid-meta">
        <datalist id="nameid-meta">
          <option value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"></option>
          <option value="urn:oasis:names:tc:SAML:2.0:nameid-format:transient"></option>
          <option value="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"></option>
          <option value="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified"></option>
        </datalist>
      </div>
      <div style="grid-column:1 / -1">
        <details>
          <summary>Advanced</summary>
          <div style="margin-top:12px">
            <div class="label">SP initiated requested NameIDFormat</div>
            <div class="small">Leave blank unless you want to send NameIDPolicy in the AuthnRequest.</div>
            <input class="input mono" name="requestedNameIdFormat" value="${esc(v.requestedNameIdFormat || "")}" placeholder="(blank)" list="nameid-req">
            <datalist id="nameid-req">
              <option value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"></option>
              <option value="urn:oasis:names:tc:SAML:2.0:nameid-format:transient"></option>
              <option value="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"></option>
              <option value="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified"></option>
            </datalist>
          </div>
        </details>
      </div>
    </div>

    <div class="btnRow" style="margin-top:18px">
      <button class="btn primary" type="submit">Create</button>
      <a class="btn" href="/">Cancel</a>
    </div>
  </form>
</div>`;

  return layout({ title: "Import", active: "import", content: body });
}

function renderConnection({ conn, baseUrl, spEntityId, acsUrl, metadataUrl, spLoginUrl, launchUrl, unsolicitedUrl }) {
  const body = `<div class="card">
  <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap">
    <div>
      <h1 style="margin:0 0 6px">Connection</h1>
      <div class="small">${esc(conn.label)}</div>
      <div class="small mono">Connection ID: ${esc(conn.id)}</div>
    </div>
    <form method="post" action="/c/${encodeURIComponent(conn.id)}/delete" onsubmit="return confirm('Delete this connection?')">
      <button class="btn" type="submit">Delete</button>
    </form>
  </div>
</div>

<div class="grid grid-2">
  <div class="card">
    <h2>SP values</h2>

    <div class="label">SP Entity ID (Issuer, Audience)</div>
    <div class="copyRow" style="margin-top:8px">
      <input class="input mono" id="spEntityId" readonly value="${esc(spEntityId)}">
      <button class="copyBtn" type="button" data-copy="spEntityId">Copy</button>
    </div>

    <div class="label" style="margin-top:12px">ACS URL</div>
    <div class="copyRow" style="margin-top:8px">
      <input class="input mono" id="acsUrl" readonly value="${esc(acsUrl)}">
      <button class="copyBtn" type="button" data-copy="acsUrl">Copy</button>
    </div>

    <div class="label" style="margin-top:12px">SP metadata URL</div>
    <div class="copyRow" style="margin-top:8px">
      <input class="input mono" id="metadataUrl" readonly value="${esc(metadataUrl)}">
      <button class="copyBtn" type="button" data-copy="metadataUrl">Copy</button>
    </div>

    <div class="btnRow" style="margin-top:12px">
      <a class="btn" href="${esc(metadataUrl)}" target="_blank" rel="noreferrer">Open metadata</a>
      <button class="btn" type="button" onclick="(async()=>{const r=await fetch('${esc(metadataUrl)}');const t=await r.text();const el=document.createElement('textarea');el.value=t;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);})()">Copy metadata XML</button>
    </div>

    <div class="label" style="margin-top:12px">SP initiated login</div>
    <div class="copyRow" style="margin-top:8px">
      <input class="input mono" id="spLoginUrl" readonly value="${esc(spLoginUrl)}">
      <button class="copyBtn" type="button" data-copy="spLoginUrl">Copy</button>
    </div>

    <div class="btnRow" style="margin-top:12px">
      <a class="btn primary" href="${esc(spLoginUrl)}">Test SP initiated</a>
      <a class="btn" href="/me">View /me</a>
    </div>
  </div>

  <div class="card">
    <h2>IdP values (from metadata)</h2>

    <div class="label">IdP Entity ID</div>
    <div class="copyRow" style="margin-top:8px">
      <input class="input mono" id="idpEntityId" readonly value="${esc(conn.idpEntityId)}">
      <button class="copyBtn" type="button" data-copy="idpEntityId">Copy</button>
    </div>

    <div class="label" style="margin-top:12px">IdP SSO URL</div>
    <div class="copyRow" style="margin-top:8px">
      <input class="input mono" id="idpSsoUrl" readonly value="${esc(conn.idpSsoUrl)}">
      <button class="copyBtn" type="button" data-copy="idpSsoUrl">Copy</button>
    </div>

    <details style="margin-top:12px">
      <summary>IdP signing certificate (PEM)</summary>
      <pre class="mono">${esc(conn.idpCertPem)}</pre>
    </details>

    <hr style="border:0;border-top:1px solid #e5e7eb;margin:14px 0">

    <h2>IdP initiated</h2>
    <div class="small">Configure the IdP to POST to the ACS URL. Some IdPs also support an Unsolicited SSO launch URL.</div>

    <div class="label" style="margin-top:12px">Tile launch URL</div>
    <div class="copyRow" style="margin-top:8px">
      <input class="input mono" id="launchUrl" readonly value="${esc(launchUrl)}">
      <button class="copyBtn" type="button" data-copy="launchUrl">Copy</button>
    </div>

    ${unsolicitedUrl ? `<div class="label" style="margin-top:12px">Unsolicited SSO URL</div>
    <div class="copyRow" style="margin-top:8px">
      <input class="input mono" id="unsolicitedUrl" readonly value="${esc(unsolicitedUrl)}">
      <button class="copyBtn" type="button" data-copy="unsolicitedUrl">Copy</button>
    </div>` : ""}

    <div class="btnRow" style="margin-top:12px">
      <a class="btn" href="${esc(launchUrl)}">Test IdP initiated launch</a>
    </div>
  </div>
</div>`;

  return layout({ title: "Connection", active: "", content: body });
}

function renderMe({ user, nowIso }) {
  const body = user
    ? `<div class="card">
  <h1>Session</h1>
  <div class="small">Now: <span class="mono">${esc(nowIso)}</span></div>
  <hr style="border:0;border-top:1px solid #e5e7eb;margin:14px 0">
  <div class="grid grid-2">
    <div><div class="label">Connection</div><div class="mono" style="margin-top:8px">${esc(user.connectionId || "")}</div></div>
    <div><div class="label">NameID</div><div class="mono" style="margin-top:8px">${esc(user.nameID || "")}</div></div>
    <div><div class="label">NameIDFormat</div><div class="mono" style="margin-top:8px">${esc(user.nameIDFormat || "")}</div></div>
    <div><div class="label">SessionIndex</div><div class="mono" style="margin-top:8px">${esc(user.sessionIndex || "")}</div></div>
  </div>
</div>

<div class="card">
  <h2>Profile</h2>
  <pre class="mono">${esc(JSON.stringify(user.profile || {}, null, 2))}</pre>
</div>`
    : `<div class="card"><h1>Me</h1><div class="small">Not signed in.</div></div>`;

  return layout({ title: "Me", active: "me", content: body });
}

module.exports = { renderHome, renderImport, renderConnection, renderMe, renderError };
