/* Looms — comments, replies, likes, dislikes, chapter votes, markdown */
(function () {
  "use strict";

  function chapterId() {
    var article = document.querySelector("article.chapter");
    if (!article) return null;
    return article.getAttribute("data-number") || location.pathname;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderMarkdown(src) {
    var s = escapeHtml(src || "");
    s = s.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\n/g, "<br>");
    return s;
  }

  async function getIdentity() {
    if (window.LoomsAuth.currentItchUser) {
      var itch = await window.LoomsAuth.currentItchUser();
      if (itch) {
        return {
          type: "itch",
          id: itch.id,
          name: itch.username,
          hex: itch.hex,
          number: 0
        };
      }
    }
    var user = await window.LoomsAuth.currentUser();
    if (user) {
      return {
        type: "user",
        id: user.id,
        name: user.username,
        hex: user.hex,
        number: 0
      };
    }
    var guest = await window.LoomsAuth.ensureGuest();
    if (!guest) return null;
    return {
      type: "guest",
      id: guest.id,
      name: window.LoomsAuth.guestDisplayName(guest.hex_code, guest.number),
      hex: guest.hex_code,
      number: guest.number
    };
  }

  async function loadComments(chapterId) {
    var client = window.LoomsAuth.getClient();
    var { data, error } = await client
      .from("comments")
      .select("*, comment_votes(vote, user_id, guest_id, itch_user_id)")
      .eq("chapter_id", String(chapterId))
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function buildTree(list) {
    var byId = {};
    var roots = [];
    list.forEach(function (c) {
      c.children = [];
      byId[c.id] = c;
    });
    list.forEach(function (c) {
      if (c.parent_id && byId[c.parent_id]) {
        byId[c.parent_id].children.push(c);
      } else {
        roots.push(c);
      }
    });
    return roots;
  }

  function voteCounts(votes, identity) {
    var likes = 0, dislikes = 0, mine = 0;
    (votes || []).forEach(function (v) {
      if (v.vote === 1) likes++;
      else if (v.vote === -1) dislikes++;
      if (identity && ((identity.type === "user" && v.user_id === identity.id) ||
                       (identity.type === "guest" && v.guest_id === identity.id) ||
                       (identity.type === "itch" && v.itch_user_id === identity.id))) {
        mine = v.vote;
      }
    });
    return { likes: likes, dislikes: dislikes, mine: mine };
  }

  function renderComment(c, identity, depth) {
    var style = window.LoomsAuth.usernameStyle(c.hex_color || "888888");
    var counts = voteCounts(c.comment_votes, identity);
    var isMine = identity && (
      (identity.type === "user" && c.user_id === identity.id) ||
      (identity.type === "guest" && c.guest_id === identity.id) ||
      (identity.type === "itch" && c.itch_user_id === identity.id)
    );
    var when = new Date(c.created_at).toLocaleString();
    var edited = c.updated_at ? " (edited)" : "";
    var rawAttr = escapeHtml(c.content || "");

    var html = '<li class="comment" data-id="' + c.id + '" style="margin-left:' + (depth * 1.4) + 'rem">';
    html += '<div class="comment-header">';
    html += '<strong class="comment-author" style="color:' + style.color + ';text-shadow:' + style.textShadow + '">' + escapeHtml(c.author_name) + '</strong>';
    html += ' <span class="comment-time">' + when + edited + '</span>';
    if (c.children && c.children.length) {
      html += ' <span class="collapse-indicator">▼</span>';
    }
    html += '</div>';
    html += '<div class="comment-body" data-raw="' + rawAttr + '">' + renderMarkdown(c.content) + '</div>';
    html += '<div class="comment-controls">';
    html += '<button class="vote-btn like" data-vote="1"' + (counts.mine === 1 ? ' data-active="1"' : '') + '>▲ ' + counts.likes + '</button>';
    html += '<button class="vote-btn dislike" data-vote="-1"' + (counts.mine === -1 ? ' data-active="1"' : '') + '>▼ ' + counts.dislikes + '</button>';
    html += '<button class="reply-btn">Reply</button>';
    if (isMine) {
      html += '<button class="edit-btn">Edit</button>';
      html += '<button class="delete-btn">Delete</button>';
    }
    html += '</div>';
    html += '<div class="reply-box" hidden></div>';
    if (c.children && c.children.length) {
      html += '<ul class="comment-replies">';
      c.children.forEach(function (child) {
        html += renderComment(child, identity, depth + 1);
      });
      html += '</ul>';
    }
    html += '</li>';
    return html;
  }

  async function renderAll() {
    var container = document.getElementById("comments");
    if (!container) return;
    var id = chapterId();
    if (!id) return;

    var client = window.LoomsAuth.getClient();
    if (!client) {
      container.innerHTML = "<p>Comments unavailable.</p>";
      return;
    }

    var identity = await getIdentity();
    var list;
    try {
      list = await loadComments(id);
    } catch (e) {
      container.innerHTML = "<p class='comment-empty'>Could not load comments.</p>";
      return;
    }

    var tree = buildTree(list);

    var { data: chVotes } = await client
      .from("chapter_votes")
      .select("vote, user_id, guest_id, itch_user_id")
      .eq("chapter_id", String(id));
    var chCounts = voteCounts(chVotes, identity);

    var html = '<div class="chapter-votes">';
    html += '<button class="vote-btn chapter-like" data-vote="1"' + (chCounts.mine === 1 ? ' data-active="1"' : '') + '>▲ Like chapter (' + chCounts.likes + ')</button>';
    html += '<button class="vote-btn chapter-dislike" data-vote="-1"' + (chCounts.mine === -1 ? ' data-active="1"' : '') + '>▼ Dislike chapter (' + chCounts.dislikes + ')</button>';
    html += '</div>';

    html += '<h2>Comments</h2>';
    if (!tree.length) {
      html += '<p class="comment-empty">No comments yet. Be the first.</p>';
    } else {
      html += '<ul class="comment-list">';
      tree.forEach(function (c) { html += renderComment(c, identity, 0); });
      html += '</ul>';
    }

    var postingAs = identity ? identity.name : "Guest";
    html += '<form id="comment-form" class="comment-form">';
    html += '<textarea name="text" rows="4" maxlength="2000" placeholder="Write a comment… (Markdown supported)" required></textarea>';
    html += '<div class="comment-actions">';
    html += '<button type="submit">Post comment</button>';
    html += '<span class="comment-as">Posting as <strong>' + escapeHtml(postingAs) + '</strong></span>';
    html += '</div></form>';

    container.innerHTML = html;
    wireEvents(id, identity);
  }

  function wireEvents(chapterId, identity) {
    var container = document.getElementById("comments");

    container.querySelector("#comment-form").onsubmit = async function (e) {
      e.preventDefault();
      var text = (new FormData(e.target).get("text") || "").trim();
      if (!text || !identity) return;
      await postComment(chapterId, text, null, identity);
      renderAll();
    };

    container.querySelectorAll(".reply-btn").forEach(function (btn) {
      btn.onclick = function () {
        var li = btn.closest(".comment");
        var box = li.querySelector(".reply-box");
        if (!box.hidden) { box.hidden = true; box.innerHTML = ""; return; }
        box.hidden = false;
        box.innerHTML = '<form class="reply-form comment-form">' +
          '<textarea rows="4" maxlength="2000" placeholder="Write a reply…" required></textarea>' +
          '<div class="comment-actions">' +
            '<button type="submit">Post reply</button>' +
            '<span class="comment-as">Posting as <strong>' + escapeHtml(identity ? identity.name : "Guest") + '</strong></span>' +
          '</div>' +
        '</form>';
        box.querySelector("form").onsubmit = async function (e) {
          e.preventDefault();
          var text = box.querySelector("textarea").value.trim();
          if (!text || !identity) return;
          await postComment(chapterId, text, li.getAttribute("data-id"), identity);
          renderAll();
        };
      };
    });

    container.querySelectorAll(".vote-btn").forEach(function (btn) {
      if (btn.classList.contains("chapter-like") || btn.classList.contains("chapter-dislike")) {
        btn.onclick = async function () {
          await setChapterVote(chapterId, parseInt(btn.getAttribute("data-vote"), 10), identity);
          renderAll();
        };
      } else {
        btn.onclick = async function () {
          var li = btn.closest(".comment");
          await setCommentVote(li.getAttribute("data-id"), parseInt(btn.getAttribute("data-vote"), 10), identity);
          renderAll();
        };
      }
    });

    container.querySelectorAll(".edit-btn").forEach(function (btn) {
      btn.onclick = function () {
        var li = btn.closest(".comment");
        var body = li.querySelector(".comment-body");
        if (!body || li.querySelector(".edit-form")) return;
        var original = body.getAttribute("data-raw") || "";
        body.style.display = "none";
        var form = document.createElement("form");
        form.className = "comment-form edit-form";
        form.innerHTML = '<textarea rows="4" maxlength="2000" required></textarea>' +
          '<div class="comment-actions">' +
            '<button type="submit">Save</button>' +
            '<button type="button" class="cancel-edit">Cancel</button>' +
          '</div>';
        form.querySelector("textarea").value = original;
        body.parentNode.insertBefore(form, body.nextSibling);
        form.querySelector("textarea").focus();

        form.querySelector(".cancel-edit").onclick = function () {
          form.remove();
          body.style.display = "";
        };

        form.onsubmit = async function (e) {
          e.preventDefault();
          var updated = form.querySelector("textarea").value.trim();
          if (!updated) return;
          var client = window.LoomsAuth.getClient();
          await client.from("comments").update({
            content: updated,
            updated_at: new Date().toISOString()
          }).eq("id", li.getAttribute("data-id"));
          renderAll();
        };
      };
    });

    container.querySelectorAll(".delete-btn").forEach(function (btn) {
      btn.onclick = async function () {
        if (!confirm("Delete this comment?")) return;
        var li = btn.closest(".comment");
        var client = window.LoomsAuth.getClient();
        await client.from("comments").delete().eq("id", li.getAttribute("data-id"));
        renderAll();
      };
    });

    // Collapse / expand by clicking the comment header
    container.querySelectorAll(".comment").forEach(function (li) {
      var header = li.querySelector(".comment-header");
      if (!header) return;
      header.onclick = function (e) {
        if (e.target.closest("button")) return;
        var replies = li.querySelector(":scope > .comment-replies");
        if (!replies) return;
        var collapsed = li.classList.toggle("is-collapsed");
        var indicator = header.querySelector(".collapse-indicator");
        if (indicator) indicator.textContent = collapsed ? "▶" : "▼";
      };
    });
  }

  async function postComment(chapterId, text, parentId, identity) {
    var client = window.LoomsAuth.getClient();
    var row = {
      chapter_id: String(chapterId),
      parent_id: parentId || null,
      author_name: identity.name,
      hex_color: identity.hex,
      content: text,
      user_id: identity.type === "user" ? identity.id : null,
      guest_id: identity.type === "guest" ? identity.id : null,
      itch_user_id: identity.type === "itch" ? identity.id : null
    };
    var { error } = await client.from("comments").insert(row);
    if (error) alert("Could not post: " + error.message);
  }

  async function setCommentVote(commentId, vote, identity) {
    if (!identity) return;
    var client = window.LoomsAuth.getClient();
    var col = identity.type === "user" ? "user_id" : (identity.type === "itch" ? "itch_user_id" : "guest_id");
    var { data: existing } = await client.from("comment_votes").select("id, vote").eq("comment_id", commentId).eq(col, identity.id).maybeSingle();
    if (existing && existing.vote === vote) {
      await client.from("comment_votes").delete().eq("id", existing.id);
    } else if (existing) {
      await client.from("comment_votes").update({ vote: vote }).eq("id", existing.id);
    } else {
      var row = { comment_id: commentId, vote: vote };
      row[col] = identity.id;
      await client.from("comment_votes").insert(row);
    }
  }

  async function setChapterVote(chapterId, vote, identity) {
    if (!identity) return;
    var client = window.LoomsAuth.getClient();
    var col = identity.type === "user" ? "user_id" : (identity.type === "itch" ? "itch_user_id" : "guest_id");
    var { data: existing } = await client.from("chapter_votes").select("id, vote").eq("chapter_id", String(chapterId)).eq(col, identity.id).maybeSingle();
    if (existing && existing.vote === vote) {
      await client.from("chapter_votes").delete().eq("id", existing.id);
    } else if (existing) {
      await client.from("chapter_votes").update({ vote: vote }).eq("id", existing.id);
    } else {
      var row = { chapter_id: String(chapterId), vote: vote };
      row[col] = identity.id;
      await client.from("chapter_votes").insert(row);
    }
  }

  window.LoomsComments = { refresh: renderAll };
  document.addEventListener("DOMContentLoaded", renderAll);
})();
