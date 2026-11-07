/* Looms — Supabase auth & guest hex colours
   Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY below
   after creating a free project at https://supabase.com
*/

(function () {
  "use strict";

  // ─── CONFIG ───────────────────────────────────────────────
  var SUPABASE_URL = "https://dxorryipqnrwnxiurwdh.supabase.co";          // e.g. https://xxxx.supabase.co
  var SUPABASE_ANON_KEY = "sb_publishable_rhJ2POck1VnQTYQeNSQIUQ_pZR2oGnG"; // public anon key
  // itch.io OAuth — create an app at https://itch.io/user/settings/oauth-apps
  // Scope: profile:me. Redirect URI: your site URL (e.g. https://trayverse-studios.github.io/looms/)
  var ITCH_CLIENT_ID = "0a8d886eaebd0d90d9b01f37d6c2e6ec";
  // ──────────────────────────────────────────────────────────

  var GUEST_ID_KEY = "looms-guest-id";
  var GUEST_HEX_KEY = "looms-guest-hex";
  var GUEST_NUM_KEY = "looms-guest-number";

  // Admin usernames (also set is_admin = true in the profiles table for extra safety)
  var ADMIN_USERNAMES = ["admin"]; // change these

  function generateHex() {
    var hex = "";
    var chars = "0123456789abcdef";
    for (var i = 0; i < 6; i++) hex += chars[Math.floor(Math.random() * 16)];
    return hex;
  }

  async function ensureGuest() {
    var client = getClient();
    if (!client) return null;

    var storedId = localStorage.getItem(GUEST_ID_KEY);
    if (storedId) {
      var { data: existing } = await client.from("guests").select("*").eq("id", storedId).single();
      if (existing) return existing;
    }

    // Find a unique hex, preferring re-rolls over incrementing the number
    var number = 0;
    var hex = null;
    var maxAttempts = 200;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      var candidate = generateHex();
      var { data: taken } = await client
        .from("guests")
        .select("id")
        .eq("hex_code", candidate)
        .eq("number", number)
        .limit(1);
      if (!taken || taken.length === 0) {
        hex = candidate;
        break;
      }
      // Prefer re-rolling colour. Only bump number after many collisions at current number.
      if (attempt > 0 && attempt % 50 === 0) number++;
    }
    if (!hex) {
      hex = generateHex();
      number = (number || 0) + 1;
    }

    var { data: inserted, error } = await client.from("guests").insert({
      hex_code: hex,
      number: number
    }).select().single();

    if (error) {
      console.error("Guest insert failed", error);
      return null;
    }

    localStorage.setItem(GUEST_ID_KEY, inserted.id);
    localStorage.setItem(GUEST_HEX_KEY, inserted.hex_code);
    localStorage.setItem(GUEST_NUM_KEY, String(inserted.number));
    return inserted;
  }

  function getGuestHex() {
    return (localStorage.getItem(GUEST_HEX_KEY) || "888888").toLowerCase();
  }

  function getGuestNumber() {
    return parseInt(localStorage.getItem(GUEST_NUM_KEY) || "0", 10);
  }

  function guestDisplayName(hex, number) {
    if (!number) return "Guest #" + hex;
    return number + "#" + hex;
  }

  function isValidUsername(name) {
    if (!name || name.length > 20) return false;
    return /^[a-zA-Z0-9._\-@]+$/.test(name);
  }

  function isValidPassword(pw) {
    if (!pw || pw.length < 8 || pw.length > 64) return false;
    return /^[\x20-\x7E]+$/.test(pw);
  }

  function luminance(hex) {
    var r = parseInt(hex.slice(0, 2), 16);
    var g = parseInt(hex.slice(2, 4), 16);
    var b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  function usernameStyle(hex) {
    var bright = luminance(hex) > 0.5;
    var outline = bright ? "#000" : "#fff";
    return {
      color: "#" + hex,
      textShadow: [
        "1px 1px 0 " + outline,
        "-1px -1px 0 " + outline,
        "1px -1px 0 " + outline,
        "-1px 1px 0 " + outline
      ].join(", ")
    };
  }

  // Supabase client (loaded via CDN in default.html)
  var supabase = null;
  function getClient() {
    if (!supabase && window.supabase) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabase;
  }

  function emailFromUsername(username) {
    return username.toLowerCase() + "@looms.local";
  }

  async function currentUser() {
    var client = getClient();
    if (!client) return null;
    var { data: { user } } = await client.auth.getUser();
    if (!user) return null;

    var { data: profile } = await client
      .from("profiles")
      .select("username, hex_color, is_admin")
      .eq("id", user.id)
      .single();

    if (!profile) return null;

    return {
      id: user.id,
      username: profile.username,
      hex: profile.hex_color || getGuestHex(),
      isAdmin: profile.is_admin || ADMIN_USERNAMES.indexOf(profile.username) !== -1
    };
  }

  async function displayName() {
    var user = await currentUser();
    if (user) return user.username;
    return "Guest #" + getGuestHex();
  }

  async function displayHex() {
    var user = await currentUser();
    return user ? user.hex : getGuestHex();
  }

  async function signup(email, username, password) {
    username = (username || "").trim();
    if (!isValidUsername(username)) throw new Error("Username: 1–20 characters, only letters, numbers, . - _ @");
    if (!isValidPassword(password)) throw new Error("Password: 8–64 characters, printable ASCII only");

    var client = getClient();
    var hex = getGuestHex();

    var { data, error } = await client.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          username: username,
          hex_color: hex
        }
      }
    });
    if (error) throw error;

    // Profile is created automatically by the database trigger.
    // If email confirmation is required, the user must confirm before they can log in.
    return data.user;
  }

  async function login(email, password) {
    if (!isValidPassword(password)) {
      throw new Error("Invalid email or password");
    }
    var client = getClient();
    var { error } = await client.auth.signInWithPassword({ email: email, password: password });
    if (error) throw new Error("Incorrect email or password");
    return await currentUser();
  }

  async function logout() {
    var client = getClient();
    await client.auth.signOut();
  }


  var ITCH_SESSION_KEY = "looms-itch-session";

  function isItchContext() {
    try {
      var params = new URLSearchParams(location.search);
      if (params.get("itch") === "1") {
        sessionStorage.setItem("looms-from-itch", "1");
        return true;
      }
      if (sessionStorage.getItem("looms-from-itch") === "1") return true;
      if (document.referrer && document.referrer.indexOf("itch.io") !== -1) {
        sessionStorage.setItem("looms-from-itch", "1");
        return true;
      }
    } catch (e) {}
    return false;
  }

  function getItchSession() {
    try {
      var raw = localStorage.getItem(ITCH_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setItchSession(obj) {
    localStorage.setItem(ITCH_SESSION_KEY, JSON.stringify(obj));
  }

  function clearItchSession() {
    localStorage.removeItem(ITCH_SESSION_KEY);
  }

  async function currentItchUser() {
    var sess = getItchSession();
    if (!sess || !sess.id) return null;
    var client = getClient();
    if (!client) return sess;
    var { data } = await client.from("itch_users").select("*").eq("id", sess.id).maybeSingle();
    if (!data) return sess;
    return {
      id: data.id,
      itchId: data.itch_id,
      username: data.username + " (itch.io)",
      hex: data.hex_color,
      isItch: true
    };
  }

  function startItchLogin() {
    var redirect = location.origin + location.pathname;
    var url = "https://itch.io/user/oauth?" +
      "client_id=" + encodeURIComponent(ITCH_CLIENT_ID) +
      "&scope=profile:me" +
      "&response_type=token" +
      "&redirect_uri=" + encodeURIComponent(redirect) +
      "&state=itch";
    location.href = url;
  }

  async function handleItchCallback() {
    if (!location.hash || location.hash.indexOf("access_token=") === -1) return;
    var params = new URLSearchParams(location.hash.slice(1));
    var token = params.get("access_token");
    if (!token) return;
    history.replaceState(null, "", location.pathname + location.search);

    var res = await fetch("https://api.itch.io/profile", {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) return;
    var body = await res.json();
    var user = body.user || body;
    if (!user || !user.id) return;

    var client = getClient();
    var { data: existing } = await client.from("itch_users").select("*").eq("itch_id", user.id).maybeSingle();
    var row = existing;
    if (!row) {
      var hex = getGuestHex();
      var { data: inserted } = await client.from("itch_users").insert({
        itch_id: user.id,
        username: user.username,
        hex_color: hex
      }).select().single();
      row = inserted;
    }
    if (row) {
      setItchSession({
        id: row.id,
        itchId: row.itch_id,
        username: row.username + " (itch.io)",
        hex: row.hex_color
      });
    }
  }

  window.LoomsAuth = {
    getGuestHex: getGuestHex,
    getGuestNumber: getGuestNumber,
    guestDisplayName: guestDisplayName,
    ensureGuest: ensureGuest,
    currentUser: currentUser,
    displayName: displayName,
    displayHex: displayHex,
    usernameStyle: usernameStyle,
    signup: signup,
    login: login,
    logout: logout,
    isAdmin: async function () {
      var u = await currentUser();
      return !!(u && u.isAdmin);
    },
    getClient: getClient,
    isItchContext: isItchContext,
    currentItchUser: currentItchUser,
    startItchLogin: startItchLogin
  };

  // Header UI
  document.addEventListener("DOMContentLoaded", function () {
    var area = document.getElementById("user-area");
    if (!area) return;

    async function render() {
      var itch = await currentItchUser();
      var user = itch ? null : await currentUser();
      var name, hex;
      if (itch) {
        name = itch.username;
        hex = itch.hex;
      } else {
        name = await displayName();
        hex = await displayHex();
      }
      var style = usernameStyle(hex);

      area.innerHTML = "";
      var span = document.createElement("span");
      span.className = "header-username";
      span.textContent = name;
      span.style.color = style.color;
      span.style.textShadow = style.textShadow;
      area.appendChild(span);

      if (itch) {
        var out = document.createElement("button");
        out.className = "auth-btn";
        out.textContent = "Log out";
        out.onclick = function () {
          clearItchSession();
          render();
          if (window.LoomsComments) window.LoomsComments.refresh();
        };
        area.appendChild(out);
      } else if (user) {
        var out2 = document.createElement("button");
        out2.className = "auth-btn";
        out2.textContent = "Log out";
        out2.onclick = async function () {
          await logout();
          render();
          if (window.LoomsComments) window.LoomsComments.refresh();
          if (window.LoomsDrafts) window.LoomsDrafts.refresh();
        };
        area.appendChild(out2);
      } else if (isItchContext()) {
        var itchBtn = document.createElement("button");
        itchBtn.className = "auth-btn";
        itchBtn.textContent = "Log in with itch.io";
        itchBtn.onclick = startItchLogin;
        area.appendChild(itchBtn);
      } else {
        var loginBtn = document.createElement("button");
        loginBtn.className = "auth-btn";
        loginBtn.textContent = "Log in";
        loginBtn.onclick = function () { showAuthModal("login"); };
        area.appendChild(loginBtn);

        var signupBtn = document.createElement("button");
        signupBtn.className = "auth-btn";
        signupBtn.textContent = "Sign up";
        signupBtn.onclick = function () { showAuthModal("signup"); };
        area.appendChild(signupBtn);
      }
    }

    function showAuthModal(mode) {
      var existing = document.getElementById("auth-modal");
      if (existing) existing.remove();

      var modal = document.createElement("div");
      modal.id = "auth-modal";
      modal.className = "auth-modal";
      modal.innerHTML =
        '<div class="auth-card">' +
          '<h2>' + (mode === "signup" ? "Create account" : "Log in") + '</h2>' +
          '<form id="auth-form">' +
            '<label>Email<br><input name="email" required pattern="[a-zA-Z0-9._\\-@]+" autocomplete=""></label>' +
            (mode === "signup" ? '<label>Username<br><input name="username" required maxlength="20" pattern="[a-zA-Z0-9._\\-@]+" autocomplete="username"></label>' : "") +
            '<label>Password<br><input name="password" type="password" required minlength="8" maxlength="64" autocomplete="' + (mode === "signup" ? "new-password" : "current-password") + '"></label>' +
            (mode === "signup" ? '<label>Confirm password<br><input name="confirm" type="password" required></label>' : '') +
            '<p class="auth-hint">Username: letters, numbers, . - _ @ (max 20). Password: 8–64 characters.</p>' +
            '<div class="auth-actions">' +
              '<button type="submit">' + (mode === "signup" ? "Create account" : "Log in") + '</button>' +
              '<button type="button" class="cancel">Cancel</button>' +
            '</div>' +
            '<p class="auth-error" hidden></p>' +
          '</form>' +
        '</div>';
      document.body.appendChild(modal);

      modal.querySelector(".cancel").onclick = function () { modal.remove(); };
      modal.onclick = function (e) { if (e.target === modal) modal.remove(); };

      modal.querySelector("#auth-form").onsubmit = async function (e) {
        e.preventDefault();
        var err = modal.querySelector(".auth-error");
        err.hidden = true;
        var fd = new FormData(e.target);
        var email = fd.get("email")
        var username = fd.get("username");
        var password = fd.get("password");
        try {
          if (mode === "signup") {
            if (password !== fd.get("confirm")) throw new Error("Passwords do not match");
            await signup(email, username, password);
          } else {
            await login(email, password);
          }
          modal.remove();
          render();
          if (window.LoomsComments) window.LoomsComments.refresh();
          if (window.LoomsDrafts) window.LoomsDrafts.refresh();
        } catch (ex) {
          err.textContent = ex.message || "Something went wrong";
          err.hidden = false;
        }
      };
    }

    handleItchCallback().then(function () { render(); });
  });
})();
