(function () {
  function setMode(mode) {
    document.querySelectorAll(".metadata-mode").forEach((el) => el.classList.remove("active"));
    const target = document.querySelector(`.metadata-mode-${mode}`);
    if (target) target.classList.add("active");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const radios = document.querySelectorAll('input[name="metadataMode"]');
    if (!radios || !radios.length) return;

    const current = [...radios].find((r) => r.checked)?.value || "url";
    setMode(current);

    radios.forEach((r) => {
      r.addEventListener("change", () => setMode(r.value));
    });
  });
})();
