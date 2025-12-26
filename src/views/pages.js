const { renderLayout } = require("./layout");
const { escapeHtml, renderJson, renderField, renderRadio, renderSelect } = require("./components");
const urls = require("../urls");

function renderHome({ baseUrl, connections, user }) {
  const sessionHtml = user
    ? `<div class="callout ok">
        <div class="callout-title">Signed in</div>
        <div class="muted">Connection: <code>${escapeHtml(user.connectionId || "")}</code></div>
        <div class="muted">NameID: <code>${escapeHtml(user.nameID || "")}</code></div>
      </div>`
    : `<div class="callout muted">
        <div class="callout-title">Not signed in</div>
        <div class="muted">Import metadata to create a connection, then test SP-initiated or IdP-initiated login.</div>
      </div>`;

  const list = connections && connections.length
    ? `<div class="grid">
        ${connections
          .map((c) => {
            const connUrl = urls.buildConnectionUrl(baseUrl, c.id);
            return `<a class="card" href="${escapeHtml(connUrl)}">
              <div class="card-title">${escapeHtml(c.displayName || c.id)}</div>
              <div class="card-sub">${escapeHtml(c.id)}</div>
            </a>`;
          })
          .join("")}
      </div>`
    : `<div class="empty">No connections yet. <a href="${escapeHtml(baseUrl)}/import">Import metadata</a>.</div>`;

  const content = `
    <div class="page">
      ${sessionHtml}
      <div class="page-head">
        <h1>Connections</h1>
        <a class="btn primary" href="${escapeHtml(baseUrl)}/import">Import metadata</a>
      </div>
      ${list}
    </div>
  `;

  return renderLayout({ title: "Home", baseUrl, activeNav: "home", content });
}

function renderImport({ baseUrl, error, values }) {
  const v = values || {};
  const metadataMode = v.metadataMode || (v.metadataUrl ? "url" : "xml") || "url";

  const errorHtml = error
    ? `<div class="callout error">
        <div class="callout-title">Import failed</div>
        <div class="muted">${escapeHtml(error)}</div>
      </div>`
    : "";

  const nameIdOptions = [
    { value: "", label: "Do not request a NameID format (recommended)" },
    { value: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient", label: "transient" },
    { value: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress", label: "emailAddress" },
    { value: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent", label: "persistent" },
    { value: "urn:mace:shibboleth:1.0:nameIdentifier", label: "shibboleth nameIdentifier" },
  ];

  const content = `
    <div class="page">
      <div class="page-head">
        <h1>Import IdP metadata</h1>
      </div>

      ${errorHtml}

      <form class="panel" method="post" action="${escapeHtml(baseUrl)}/import">
        ${renderField({
          label: "Display name",
          name: "displayName",
          value: v.displayName || "",
          placeholder: "Optional",
          help: "Shown on the home page. If blank, we’ll use the IdP entityID.",
        })}

        ${renderRadio({
          legend: "Metadata source",
          name: "metadataMode",
          value: metadataMode,
          help: "Choose how you want to provide the IdP metadata.",
          options: [
            { value: "url", label: "Metadata URL" },
            { value: "xml", label: "Metadata XML" },
          ],
        })}

        <div class="metadata-mode metadata-mode-url">
          ${renderField({
            label: "Metadata URL",
            name: "metadataUrl",
            value: v.metadataUrl || "",
            placeholder: "https://…/idp/profile/Metadata/SAML",
            help: "Paste the IdP metadata URL.",
          })}
        </div>

        <div class="metadata-mode metadata-mode-xml">
          ${renderField({
            label: "Metadata XML",
            name: "metadataXml",
            type: "textarea",
            value: v.metadataXml || "",
            placeholder: "<EntityDescriptor …>…</EntityDescriptor>",
            help: "Paste the full XML metadata.",
            rows: 10,
          })}
        </div>

        ${renderSelect({
          label: "Requested NameID format (SP-initiated only)",
          name: "requestedNameIdFormat",
          value: v.requestedNameIdFormat || "",
          options: nameIdOptions,
          help: "Some IdPs reject AuthnRequests that ask for an unsupported NameID format. Leaving this blank is the most compatible.",
        })}

        <div class="actions">
          <button class="btn primary" type="submit">Create connection</button>
          <a class="btn" href="${escapeHtml(baseUrl)}/">Cancel</a>
        </div>
      </form>
    </div>
  `;

  return renderLayout({ title: "Import", baseUrl, activeNav: "import", content });
}

function renderConnection({ baseUrl, conn }) {
  const issuer = urls.buildSpIssuer(baseUrl, conn.id);
  const acsUrl = urls.buildAcsUrl(baseUrl, conn.id);
  const metadataUrl = urls.buildMetadataUrl(baseUrl, conn.id);
  const loginUrl = urls.buildLoginUrl(baseUrl, conn.id);

  const providerId = encodeURIComponent(issuer);

  const content = `
    <div class="page">
      <div class="page-head">
        <h1>${escapeHtml(conn.displayName || conn.id)}</h1>
        <div class="muted">Connection ID: <code>${escapeHtml(conn.id)}</code></div>
      </div>

      <section class="panel">
        <h2>SP values</h2>

        <div class="kv">
          <div class="k">SP Entity ID (Issuer)</div>
          <div class="v"><code>${escapeHtml(issuer)}</code></div>

          <div class="k">ACS URL</div>
          <div class="v"><code>${escapeHtml(acsUrl)}</code></div>

          <div class="k">SP metadata URL</div>
          <div class="v"><code>${escapeHtml(metadataUrl)}</code></div>

          <div class="k">SP-initiated login</div>
          <div class="v"><code>${escapeHtml(loginUrl)}</code></div>

          <div class="k">RapidIdentity providerId (URL-encoded)</div>
          <div class="v"><code>${escapeHtml(providerId)}</code></div>
        </div>
      </section>

      <section class="panel">
        <h2>IdP values (from metadata)</h2>
        <div class="kv">
          <div class="k">IdP Entity ID</div>
          <div class="v"><code>${escapeHtml(conn.idpEntityId)}</code></div>

          <div class="k">IdP SSO URL</div>
          <div class="v"><code>${escapeHtml(conn.idpSsoUrl)}</code></div>
        </div>

        ${conn.nameIdFormats && conn.nameIdFormats.length
          ? `<div class="muted" style="margin-top: 12px;">
              NameID formats in metadata:
              ${conn.nameIdFormats.map((x) => `<code>${escapeHtml(x)}</code>`).join(" ")}
            </div>`
          : ""}

      </section>

      <section class="panel">
        <h2>Actions</h2>
        <div class="actions">
          <a class="btn primary" href="${escapeHtml(loginUrl)}">Test SP-initiated</a>
          <a class="btn" href="${escapeHtml(baseUrl)}/me">View /me</a>
          <form method="post" action="${escapeHtml(baseUrl)}/c/${encodeURIComponent(conn.id)}/delete" style="display:inline;">
            <button class="btn danger" type="submit" onclick="return confirm('Delete this connection?');">Delete</button>
          </form>
        </div>
        <div class="muted" style="margin-top:10px;">
          For IdP-initiated tests, configure your IdP to POST the SAMLResponse to the ACS URL above.
        </div>
      </section>
    </div>
  `;

  return renderLayout({ title: conn.displayName || conn.id, baseUrl, content });
}

function renderMe({ baseUrl, user }) {
  const content = `
    <div class="page">
      <div class="page-head">
        <h1>Me</h1>
      </div>

      ${user
        ? `<section class="panel">
            <h2>Session</h2>
            <div class="kv">
              <div class="k">Connection</div>
              <div class="v"><code>${escapeHtml(user.connectionId || "")}</code></div>

              <div class="k">NameID</div>
              <div class="v"><code>${escapeHtml(user.nameID || "")}</code></div>

              <div class="k">NameIDFormat</div>
              <div class="v"><code>${escapeHtml(user.nameIDFormat || "")}</code></div>

              <div class="k">SessionIndex</div>
              <div class="v"><code>${escapeHtml(user.sessionIndex || "")}</code></div>
            </div>
          </section>

          <section class="panel">
            <h2>Profile</h2>
            ${renderJson(user.profile || {})}
          </section>`
        : `<div class="callout muted">
            <div class="callout-title">Not signed in</div>
            <div class="muted">Start from a connection page and run SP-initiated login, or use your IdP tile.</div>
          </div>`}
    </div>
  `;

  return renderLayout({ title: "Me", baseUrl, activeNav: "me", content });
}

function renderError({ baseUrl, title, message, details, actions }) {
  const actionsHtml = actions && actions.length
    ? `<div class="actions">
        ${actions.map((a) => `<a class="btn ${a.primary ? "primary" : ""}" href="${escapeHtml(a.href)}">${escapeHtml(a.label)}</a>`).join("")}
      </div>`
    : `<div class="actions">
        <a class="btn" href="${escapeHtml(baseUrl)}/">Home</a>
        <a class="btn" href="${escapeHtml(baseUrl)}/import">Import</a>
      </div>`;

  const content = `
    <div class="page">
      <div class="callout error">
        <div class="callout-title">${escapeHtml(title || "Error")}</div>
        <div class="muted">${escapeHtml(message || "")}</div>
        ${details ? `<pre class="code"><code>${escapeHtml(details)}</code></pre>` : ""}
        ${actionsHtml}
      </div>
    </div>
  `;

  return renderLayout({ title: title || "Error", baseUrl, content });
}

module.exports = {
  renderHome,
  renderImport,
  renderConnection,
  renderMe,
  renderError,
};
