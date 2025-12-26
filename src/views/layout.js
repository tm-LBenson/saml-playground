function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLayout({ title, content }) {
  const pageTitle = title ? `${escapeHtml(title)} · SAML Playground` : "SAML Playground";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${pageTitle}</title>
  <link rel="stylesheet" href="/public/style.css" />
  <script src="/public/import.js" defer></script>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="/"><span class="dot" aria-hidden="true"></span><span>SAML Playground</span></a>
      <nav class="nav">
        <a href="/">Home</a>
        <a href="/import">Import</a>
        <a href="/me">Me</a>
        <a href="/logout">Logout</a>
      </nav>
    </div>
  </header>

  <main class="container">
    ${content}
  </main>

  <footer class="footer">
    <span class="muted">SAML Playground</span>
  </footer>
</body>
</html>`;
}

module.exports = { renderLayout, escapeHtml };
