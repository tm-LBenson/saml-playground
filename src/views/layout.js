function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout({ title, body, activePath }) {
  const t = esc(title || "SAML Playground");
  const nav = [
    { href: "/", label: "Home" },
    { href: "/import", label: "Import" },
    { href: "/me", label: "Me" },
    { href: "/logout", label: "Logout" },
  ]
    .map((i) => {
      const active = activePath === i.href ? "nav-active" : "";
      return `<a class="nav-link ${active}" href="${i.href}">${esc(i.label)}</a>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<style>
:root{
  --ri-red:#d32f2f;
  --text:#111827;
  --muted:#6b7280;
  --border:#e5e7eb;
  --bg:#f6f7f9;
  --card:#ffffff;
  --focus:rgba(211,47,47,.25);
}
*{box-sizing:border-box}
body{
  margin:0;
  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
  background:var(--bg);
  color:var(--text);
}
header{
  background:var(--card);
  border-bottom:1px solid var(--border);
}
.wrap{
  max-width:980px;
  margin:0 auto;
  padding:16px;
}
.topbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}
.brand{
  display:flex;
  align-items:center;
  gap:10px;
  font-weight:700;
  letter-spacing:.2px;
}
.brand-dot{
  width:10px;
  height:10px;
  border-radius:999px;
  background:var(--ri-red);
}
nav{display:flex;gap:10px;flex-wrap:wrap}
.nav-link{
  text-decoration:none;
  color:var(--muted);
  padding:8px 10px;
  border-radius:10px;
}
.nav-link:hover{background:#f2f3f5;color:var(--text)}
.nav-active{color:var(--text);background:#f2f3f5}
main{padding:22px 0}
h1,h2{margin:0 0 10px 0}
h1{font-size:22px}
h2{font-size:16px}
.card{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:14px;
  padding:16px;
  margin:0 0 14px 0;
}
.grid{
  display:grid;
  grid-template-columns:1fr;
  gap:12px;
}
@media(min-width:900px){
  .grid-2{grid-template-columns:1fr 1fr}
}
.label{
  display:flex;
  align-items:center;
  gap:8px;
  font-size:13px;
  color:var(--muted);
  margin:0 0 6px 0;
}
.help{
  display:inline-flex;
  width:18px;height:18px;
  border-radius:999px;
  align-items:center;
  justify-content:center;
  border:1px solid var(--border);
  color:var(--muted);
  font-size:12px;
}
.input, textarea{
  width:100%;
  border:1px solid var(--border);
  border-radius:12px;
  padding:10px 12px;
  font-size:14px;
  background:#fff;
  outline:none;
}
textarea{min-height:120px;resize:vertical}
.input:focus, textarea:focus{
  border-color:var(--ri-red);
  box-shadow:0 0 0 4px var(--focus);
}
.row{
  display:flex;
  gap:10px;
  align-items:center;
}
.btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  padding:10px 12px;
  border-radius:12px;
  border:1px solid var(--border);
  background:#fff;
  color:var(--text);
  text-decoration:none;
  cursor:pointer;
  font-size:14px;
}
.btn-primary{
  background:var(--ri-red);
  border-color:var(--ri-red);
  color:#fff;
}
.btn:hover{filter:brightness(.98)}
.btn-primary:hover{filter:brightness(.95)}
.kv{
  display:grid;
  grid-template-columns:1fr;
  gap:10px;
}
.kv-item{
  display:flex;
  flex-direction:column;
  gap:6px;
}
.mono{
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
}
.small{font-size:12px;color:var(--muted)}
.err{
  border-color:rgba(220,38,38,.35);
  background:rgba(220,38,38,.04);
}
pre{
  margin:0;
  white-space:pre-wrap;
  word-break:break-word;
  background:#fafafa;
  border:1px solid var(--border);
  border-radius:12px;
  padding:12px;
}
hr{border:none;border-top:1px solid var(--border);margin:14px 0}
</style>
<script>
function copyText(id){
  const el = document.getElementById(id);
  if(!el) return;
  const text = el.value !== undefined ? el.value : el.textContent;
  navigator.clipboard.writeText(text);
}
</script>
</head>
<body>
<header>
  <div class="wrap topbar">
    <div class="brand"><span class="brand-dot"></span><span>SAML Playground</span></div>
    <nav>${nav}</nav>
  </div>
</header>
<main>
  <div class="wrap">
    ${body || ""}
  </div>
</main>
</body>
</html>`;
}

module.exports = { layout, esc };
