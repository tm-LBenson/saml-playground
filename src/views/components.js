function escapeHtml(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderJson(obj) {
  const safe = escapeHtml(JSON.stringify(obj, null, 2));
  return `<pre class="code"><code>${safe}</code></pre>`;
}

function renderField({
  label,
  name,
  value = "",
  placeholder = "",
  help = "",
  type = "text",
  required = false,
  rows = 6,
}) {
  const helpHtml = help
    ? `<span class="help" tabindex="0" aria-label="Help" data-help="${escapeHtml(help)}">?</span>`
    : "";

  if (type === "textarea") {
    return `
<div class="field">
  <label for="${escapeHtml(name)}">${escapeHtml(label)} ${helpHtml}</label>
  <textarea id="${escapeHtml(name)}" name="${escapeHtml(name)}" placeholder="${escapeHtml(placeholder)}" rows="${rows}" ${required ? "required" : ""}>${escapeHtml(value)}</textarea>
</div>`;
  }

  return `
<div class="field">
  <label for="${escapeHtml(name)}">${escapeHtml(label)} ${helpHtml}</label>
  <input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? "required" : ""}/>
</div>`;
}

function renderRadio({
  legend,
  name,
  options,
  value,
  help = "",
}) {
  const helpHtml = help
    ? `<span class="help" tabindex="0" aria-label="Help" data-help="${escapeHtml(help)}">?</span>`
    : "";

  const radios = options
    .map((opt) => {
      const checked = String(value) === String(opt.value) ? "checked" : "";
      return `
<label class="radio">
  <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(opt.value)}" ${checked}/>
  <span>${escapeHtml(opt.label)}</span>
</label>`;
    })
    .join("");

  return `
<fieldset class="field">
  <legend>${escapeHtml(legend)} ${helpHtml}</legend>
  <div class="radio-group">${radios}</div>
</fieldset>`;
}

function renderSelect({ label, name, options, value, help = "" }) {
  const helpHtml = help
    ? `<span class="help" tabindex="0" aria-label="Help" data-help="${escapeHtml(help)}">?</span>`
    : "";
  const opts = options
    .map((opt) => {
      const selected = String(value) === String(opt.value) ? "selected" : "";
      return `<option value="${escapeHtml(opt.value)}" ${selected}>${escapeHtml(opt.label)}</option>`;
    })
    .join("");
  return `
<div class="field">
  <label for="${escapeHtml(name)}">${escapeHtml(label)} ${helpHtml}</label>
  <select id="${escapeHtml(name)}" name="${escapeHtml(name)}">${opts}</select>
</div>`;
}

module.exports = {
  escapeHtml,
  renderJson,
  renderField,
  renderRadio,
  renderSelect,
};
