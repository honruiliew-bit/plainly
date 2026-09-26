/* Plainly embed loader. Usage:
   <div data-plainly data-limit="5"></div>
   <script src="https://YOUR-SITE/embed.js" async></script> */
(function () {
  var base = document.currentScript ? new URL(document.currentScript.src).origin : "";
  document.querySelectorAll("[data-plainly]").forEach(function (host) {
    if (host.getAttribute("data-ready")) return;
    host.setAttribute("data-ready", "1");
    var f = document.createElement("iframe");
    f.src = base + "/embed?limit=" + (host.getAttribute("data-limit") || 5);
    f.title = "Plainly news widget";
    f.loading = "lazy";
    f.style.cssText = "width:100%;height:420px;border:1px solid #DDD5C4;border-radius:16px;background:#F5F0E6";
    host.appendChild(f);
    window.addEventListener("message", function (e) {
      if (e.source === f.contentWindow && e.data && e.data.plainly === "height") {
        f.style.height = e.data.value + 2 + "px";
      }
    });
  });
})();
