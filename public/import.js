(function () {
  function setMode(mode) {
    document.querySelectorAll("[data-mode]").forEach((el) => {
      el.style.display = el.getAttribute("data-mode") === mode ? "" : "none";
    });
  }

  function init() {
    const radios = document.querySelectorAll('input[name="metadataMode"]');
    if (!radios.length) return;

    function read() {
      const checked = document.querySelector('input[name="metadataMode"]:checked');
      return checked ? checked.value : "url";
    }

    setMode(read());

    radios.forEach((r) => {
      r.addEventListener("change", () => setMode(read()));
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
