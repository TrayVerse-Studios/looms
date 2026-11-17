/* Looms — show draft/hidden/future chapters to admins; redirect non-admins away from restricted chapters.
   Future chapters (release date/time after now) are treated as drafts for non-admins.
   Release times are displayed in the user's local timezone. */
(function () {
  "use strict";

  function computeReleaseUTC(dateStr, timeStr, offsetHours) {
    if (!dateStr) return null;
    var parts = dateStr.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    var y = parts[0], m = parts[1], d = parts[2];
    var tparts = (timeStr || "00:00").split(":").map(Number);
    var hh = tparts[0] || 0;
    var mm = tparts[1] || 0;
    var offset = parseInt(offsetHours, 10) || 0;
    // Date.UTC gives the UTC timestamp for the wall-clock numbers; subtract offset hours to get true UTC
    var utcMs = Date.UTC(y, m - 1, d, hh, mm) - (offset * 3600 * 1000);
    return utcMs;
  }

  function isFutureRelease(el) {
    var dateStr = el.getAttribute("data-release-date");
    if (!dateStr) return false;
    var timeStr = el.getAttribute("data-release-time") || "00:00";
    var offset = el.getAttribute("data-timezone-offset") || "0";
    var utcMs = computeReleaseUTC(dateStr, timeStr, offset);
    if (utcMs == null) return false;
    return utcMs > Date.now();
  }

  function formatLocalTime(dateStr, timeStr, offsetHours) {
    var utcMs = computeReleaseUTC(dateStr, timeStr, offsetHours);
    if (utcMs == null) return "";
    try {
      return new Date(utcMs).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      });
    } catch (e) {
      return new Date(utcMs).toLocaleString();
    }
  }

  function hideRestrictedImmediately() {
    var restricted = document.querySelector("article.chapter[data-restricted]");
    if (restricted) {
      restricted.style.visibility = "hidden";
      restricted.setAttribute("aria-hidden", "true");
    }
  }

  async function refresh() {
    var isAdmin = false;
    if (window.LoomsAuth && window.LoomsAuth.isAdmin) {
      isAdmin = await window.LoomsAuth.isAdmin();
    }

    // Chapter list: hide drafts, hidden, and future-release items for non-admins
    var items = document.querySelectorAll(".chapter-list li");
    for (var i = 0; i < items.length; i++) {
      var li = items[i];
      var draft = li.getAttribute("data-draft") === "true";
      var hidden = li.getAttribute("data-hidden") === "true";
      var future = isFutureRelease(li);
      if ((draft || hidden || future) && !isAdmin) {
        li.style.display = "none";
      } else {
        li.style.display = "";
      }
      // Optional: show a small release hint for admins on future items
      var tag = li.querySelector(".release-tag");
      if (tag && future) {
        tag.hidden = false;
        tag.textContent = " (scheduled)";
      }
    }

    // Chapter page: display local release time + enforce future-as-draft
    var article = document.querySelector("article.chapter");
    if (article) {
      var dateStr = article.getAttribute("data-release-date");
      var timeStr = article.getAttribute("data-release-time") || "00:00";
      var offset = article.getAttribute("data-timezone-offset") || "0";
      var localEl = article.querySelector(".local-release-time");
      if (localEl && dateStr) {
        localEl.textContent = formatLocalTime(dateStr, timeStr, offset) || "Unknown";
      }

      // Prefer canonical release time from Supabase when available
      if (window.LoomsAuth && window.LoomsAuth.getClient) {
        var client = window.LoomsAuth.getClient();
        var slug = article.getAttribute("data-slug");
        if (client && slug && localEl) {
          client.from("chapters").select("release_at").eq("slug", slug).maybeSingle().then(function (res) {
            if (res.data && res.data.release_at) {
              try {
                localEl.textContent = new Date(res.data.release_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short"
                });
              } catch (e) {
                localEl.textContent = new Date(res.data.release_at).toLocaleString();
              }
            }
          }).catch(function () {});
        }
      }

      var future = isFutureRelease(article);
      var alreadyRestricted = article.getAttribute("data-restricted") === "true";
      if (future && !alreadyRestricted) {
        // Mark as restricted for the redirect logic below
        article.setAttribute("data-restricted", "true");
        var notfound = article.getAttribute("data-notfound") || "/404.html";
        if (!article.getAttribute("data-notfound")) {
          article.setAttribute("data-notfound", notfound);
        }
      }

      if (future) {
        var banner = article.querySelector(".future-banner");
        if (banner) banner.hidden = false;
      }

      if (article.getAttribute("data-restricted") === "true") {
        if (!isAdmin) {
          var nf = article.getAttribute("data-notfound") || "/404.html";
          window.location.replace(nf);
          return;
        }
        // Admin: reveal
        article.style.visibility = "";
        article.removeAttribute("aria-hidden");
      }
    }
  }

  window.LoomsDrafts = { refresh: refresh };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      hideRestrictedImmediately();
      refresh();
    });
  } else {
    hideRestrictedImmediately();
    refresh();
  }
})();
