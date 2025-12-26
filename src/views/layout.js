const { escapeHtml } = require("./components");

function renderLayout({ title, baseUrl, activeNav = "", content }) {
  const fullTitle = title ? `${title} • SAML Playground` : "SAML Playground";

  function navLink(href, label, key) {
    const cls = activeNav === key ? "nav-link active" : "nav-link";
    return `<a class="${cls}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(fullTitle)}</title>
  <link rel="stylesheet" href="${escapeHtml(baseUrl)}/public/style.css"/>
</head>
<body>
  <header class="topbar">
    <div class="container topbar-inner">
      <div class="brand">
        <span class="dot" aria-hidden="true"></span>
        <a href="${escapeHtml(baseUrl)}/" class="brand-title">SAML Playground</a>
      </div>
      <nav class="nav">
        ${navLink(`${baseUrl}/`, "Home", "home")}
        ${navLink(`${baseUrl}/import`, "Import", "import")}
        ${navLink(`${baseUrl}/me`, "Me", "me")}
        ${navLink(`${baseUrl}/logout`, "Logout", "logout")}
      </nav>
    </div>
  </header>

  <main class="container">
    ${content}
  </main>

  <script src="${escapeHtml(baseUrl)}/public/app.js" defer></script>
</body>
</html>`;
}

module.exports = { renderLayout };
