/* Looms — show draft/hidden chapters to admins */
(function () {
  "use strict";

  async function refresh() {
    var isAdmin = false;
    if (window.LoomsAuth && window.LoomsAuth.isAdmin) {
      isAdmin = await window.LoomsAuth.isAdmin();
    }
    var items = document.querySelectorAll(".chapter-list li[data-draft], .chapter-list li[data-hidden]");
    for (var i = 0; i < items.length; i++) {
      var li = items[i];
      var draft = li.getAttribute("data-draft") === "true";
      var hidden = li.getAttribute("data-hidden") === "true";
      if ((draft || hidden) && !isAdmin) {
        li.style.display = "none";
      } else {
        li.style.display = "";
      }
    }
  }

  window.LoomsDrafts = { refresh: refresh };

  document.addEventListener("DOMContentLoaded", refresh);
})();
