function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout({ title, active, content }) {
  const navItem = (href, label, key) => {
    const cls = key === active ? "navLink active" : "navLink";
    return `<a class="${cls}" href="${href}">${esc(label)}</a>`;
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - SAML Playground</title>
<style>
:root{
  --bg:#ffffff;
  --text:#111827;
  --muted:#6b7280;
  --border:#e5e7eb;
  --card:#ffffff;
  --accent:#b71c1c;
  --accent-weak:#fdecec;
  --shadow:0 1px 2px rgba(0,0,0,.04);
  --radius:12px;
  --mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
  --sans:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
}
*{box-sizing:border-box}
body{margin:0;font-family:var(--sans);background:var(--bg);color:var(--text)}
.topbar{border-bottom:1px solid var(--border);background:#fff}
.topbarInner{max-width:980px;margin:0 auto;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.2px}
.dot{width:8px;height:8px;border-radius:999px;background:var(--accent);display:inline-block}
.nav{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.navLink{text-decoration:none;color:var(--muted);padding:8px 10px;border-radius:10px;border:1px solid transparent}
.navLink:hover{background:#fafafa;border-color:var(--border);color:var(--text)}
.navLink.active{color:var(--text);border-color:var(--border);background:#fafafa}
main{max-width:980px;margin:0 auto;padding:18px 16px 40px}
h1{font-size:22px;margin:0 0 12px}
h2{font-size:15px;margin:0 0 10px}
.small{color:var(--muted);font-size:13px;line-height:1.4}
.mono{font-family:var(--mono)}
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:16px;margin-bottom:14px}
.err{border-color:#f2b3b3;background:var(--accent-weak)}
.grid{display:grid;gap:12px}
.grid-2{grid-template-columns:1fr 1fr}
@media (max-width:760px){.grid-2{grid-template-columns:1fr}}
.label{font-weight:700;font-size:13px}
.input,textarea{width:100%;border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;margin-top:8px;background:#fff;color:var(--text)}
textarea{min-height:140px;resize:vertical}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:#fff;color:var(--text);font-weight:700;font-size:14px;text-decoration:none;cursor:pointer}
.btn:hover{background:#fafafa}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.primary:hover{filter:brightness(.97)}
.btnRow{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.copyRow{display:flex;gap:8px;align-items:center}
.copyRow .input{margin-top:0}
.copyBtn{padding:10px 10px;border-radius:10px;border:1px solid var(--border);background:#fff;cursor:pointer;font-weight:700}
.copyBtn:hover{background:#fafafa}
.radioRow{display:flex;gap:14px;flex-wrap:wrap}
label.radio{display:flex;align-items:center;gap:8px;font-weight:700}
details summary{cursor:pointer;color:var(--muted);font-weight:700}
pre{margin:10px 0 0;padding:12px;border:1px solid var(--border);border-radius:10px;background:#fafafa;overflow:auto;font-size:12px;line-height:1.4}
.kv{display:flex;flex-direction:column;gap:6px}
</style>
</head>
<body>
<div class="topbar">
  <div class="topbarInner">
    <div class="brand"><span class="dot"></span><span>SAML Playground</span></div>
    <nav class="nav">
      ${navItem("/", "Home", "home")}
      ${navItem("/import", "Import", "import")}
      ${navItem("/me", "Me", "me")}
      ${navItem("/logout", "Logout", "logout")}
    </nav>
  </div>
</div>

<main>
${content}
</main>

<script>
(function () {
  function copyText(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-copy");
      const el = document.getElementById(targetId);
      if (!el) return;
      copyText(el.value || el.textContent || "");
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = "Copy"), 800);
    });
  });

  const form = document.querySelector("form[data-import-form]");
  if (!form) return;

  const urlWrap = document.getElementById("wrap_url");
  const xmlWrap = document.getElementById("wrap_xml");
  const urlInput = document.getElementById("metadataUrl");
  const xmlInput = document.getElementById("metadataXml");

  function syncMode() {
    const checked = form.querySelector('input[name="metadataSource"]:checked');
    const mode = checked ? checked.value : "url";
    const isUrl = mode === "url";
    urlWrap.style.display = isUrl ? "" : "none";
    xmlWrap.style.display = isUrl ? "none" : "";
    urlInput.disabled = !isUrl;
    urlInput.required = isUrl;
    xmlInput.disabled = isUrl;
    xmlInput.required = !isUrl;
  }

  form.querySelectorAll('input[name="metadataSource"]').forEach((r) => r.addEventListener("change", syncMode));
  syncMode();
})();
</script>
</body>
</html>`;
}

module.exports = { layout, esc };
