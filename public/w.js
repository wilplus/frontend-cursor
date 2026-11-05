/* WillpowerLab: your chat on any website (backend N565).
   Paste before </body>:
     <script src="https://willpowerlab.com/w.js" data-link="<your link's token>" async></script>
   One pill at the bottom right, inside a shadow root so the site's styles and
   ours never meet; the chat itself is an iframe to willpowerlab.com, so the
   site's page and scripts never see what a visitor taps. */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || window.__wplWidget) return;
  var token = script.getAttribute("data-link") || "";
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return;
  window.__wplWidget = true;
  var origin = new URL(script.src).origin;
  var site = location.hostname || "";

  function mount() {
    var host = document.createElement("div");
    host.setAttribute("data-willpowerlab-widget", "");
    var root = host.attachShadow ? host.attachShadow({ mode: "closed" }) : host;
    var style = document.createElement("style");
    style.textContent =
      ":host{all:initial}" +
      "iframe{position:fixed;right:8px;bottom:8px;z-index:2147483000;border:0;background:transparent;" +
      "color-scheme:normal;width:0;height:0;visibility:hidden;border-radius:22px;" +
      "transition:width .2s ease,height .2s ease}" +
      "iframe.open{box-shadow:0 24px 60px rgba(0,0,0,.3)}";
    var frame = document.createElement("iframe");
    frame.title = "Chat";
    frame.setAttribute("allowtransparency", "true");
    frame.src = origin + "/w/" + encodeURIComponent(token) + (site ? "?site=" + encodeURIComponent(site) : "");
    root.appendChild(style);
    root.appendChild(frame);
    document.body.appendChild(host);

    function fit(state, w, h) {
      if (state === "open") {
        var gap = window.innerWidth < 520 ? 8 : 20;
        frame.style.width = Math.min(400, window.innerWidth - gap * 2) + "px";
        frame.style.height = Math.min(660, window.innerHeight - gap * 2) + "px";
        frame.style.right = frame.style.bottom = gap + "px";
        frame.className = "open";
      } else {
        frame.style.width = Math.max(60, Math.min(w || 220, window.innerWidth - 16)) + "px";
        frame.style.height = Math.max(60, Math.min(h || 76, 120)) + "px";
        frame.style.right = frame.style.bottom = "8px";
        frame.className = "";
      }
      frame.style.visibility = "visible";
    }

    var last = { state: "closed", w: 0, h: 0 };
    window.addEventListener("message", function (event) {
      if (event.origin !== origin || event.source !== frame.contentWindow) return;
      var d = event.data;
      if (!d || d.wpl !== "widget") return;
      last = { state: d.state, w: d.w, h: d.h };
      fit(d.state, d.w, d.h);
    });
    window.addEventListener("resize", function () {
      if (frame.style.visibility === "visible") fit(last.state, last.w, last.h);
    });
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
