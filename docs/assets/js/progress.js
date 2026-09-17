(function () {
  var KEY = "looms-reading-progress";

  function readProgress() {
    try {
      var raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeProgress(data) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function scrollFraction() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if (max <= 0) return 0;
    return Math.min(1, Math.max(0, window.scrollY / max));
  }

  function applyScroll(fraction) {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0 || fraction < 0.02) return;
    window.scrollTo(0, Math.round(max * fraction));
  }

  function saveFromChapter(article) {
    writeProgress({
      url: window.location.pathname,
      title: article.getAttribute("data-title") || document.title,
      number: article.getAttribute("data-number") || "",
      scroll: scrollFraction(),
      updated: Date.now()
    });
  }

  var article = document.querySelector("[data-progress='true']");
  if (article) {
    var saved = readProgress();
    if (saved && saved.url === window.location.pathname && typeof saved.scroll === "number") {
      window.requestAnimationFrame(function () {
        applyScroll(saved.scroll);
      });
    }
    saveFromChapter(article);

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        saveFromChapter(article);
        ticking = false;
      });
    }, { passive: true });

    window.addEventListener("pagehide", function () {
      saveFromChapter(article);
    });
  }

  var saved = readProgress();
  var hasProgress = !!(saved && saved.url && saved.url !== "#");

  var continueLinks = document.querySelectorAll("[data-continue]");
  var startLinks = document.querySelectorAll("[data-start]");

  if (hasProgress) {
    for (var i = 0; i < continueLinks.length; i++) {
      var el = continueLinks[i];
      el.hidden = false;
      if (el.tagName === "A") {
        el.href = saved.url;
      }
      var label = el.querySelector("[data-continue-label]");
      if (label) {
        label.textContent = saved.title || "Continue reading";
      }
    }
    for (var s = 0; s < startLinks.length; s++) {
      startLinks[s].classList.add("ghost");
    }
  } else {
    for (var c = 0; c < continueLinks.length; c++) {
      continueLinks[c].hidden = true;
    }
    for (var t = 0; t < startLinks.length; t++) {
      startLinks[t].classList.remove("ghost");
    }
  }

  if (!hasProgress) return;

  var marks = document.querySelectorAll("[data-chapter-url]");
  for (var j = 0; j < marks.length; j++) {
    if (marks[j].getAttribute("data-chapter-url") === saved.url) {
      marks[j].classList.add("is-current");
    }
  }
})();
