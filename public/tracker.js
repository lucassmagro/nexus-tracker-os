/**
 * Nexus Tracker OS — Client-Side Tracking Pixel v2
 * Lightweight, privacy-conscious attribution tracker.
 *
 * Usage:
 *   <script src="https://your-domain.com/tracker.js" defer></script>
 *   <script>
 *     window.nexus('init', 'YOUR_WORKSPACE_ID');
 *   </script>
 *
 * @version 2.0.0
 * @license MIT
 */
;(function () {
  "use strict";

  var ENDPOINT = "http://localhost:3000/track";
  var COOKIE   = "_nxs_tracker";
  var TTL_DAYS = 30;
  var _workspaceId = null;
  var _initialized = false;

  // ── UTM Extraction ──────────────────────────────────────────────────────
  function getUtms() {
    var params = new URLSearchParams(location.search);
    var keys   = ["utm_source", "utm_campaign", "utm_medium", "utm_term", "utm_content"];
    var utms   = {};
    for (var i = 0; i < keys.length; i++) {
      var v = params.get(keys[i]);
      if (v) utms[keys[i]] = v;
    }
    return utms;
  }

  // ── Anonymous Fingerprint ───────────────────────────────────────────────
  function fingerprint() {
    var raw = [
      navigator.userAgent,
      screen.width + "x" + screen.height,
      navigator.language,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    ].join("|");
    return hash(raw);
  }

  // DJB2a hash — fast, deterministic, tiny.
  function hash(str) {
    for (var h = 5381, i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
      h = h >>> 0;
    }
    return h.toString(16);
  }

  // ── UUIDv4 ──────────────────────────────────────────────────────────────
  function uuid() {
    var d = typeof crypto !== "undefined" && crypto.getRandomValues
      ? function () { return crypto.getRandomValues(new Uint8Array(1))[0]; }
      : function () { return (Math.random() * 256) | 0; };

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = d() & 0x0f;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // ── Cookie Helpers ──────────────────────────────────────────────────────
  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 864e5);
    document.cookie =
      name + "=" + encodeURIComponent(value) +
      ";expires=" + d.toUTCString() +
      ";path=/;SameSite=Lax";
  }

  // ── Session ID ──────────────────────────────────────────────────────────
  function getSessionId() {
    var sid = getCookie(COOKIE);
    if (!sid) {
      sid = uuid();
      setCookie(COOKIE, sid, TTL_DAYS);
    }
    return sid;
  }

  // ── Send Payload ────────────────────────────────────────────────────────
  function send(payload) {
    var json = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      var blob = new Blob([json], { type: "application/json" });
      var queued = navigator.sendBeacon(ENDPOINT, blob);
      if (queued) return;
    }

    try {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json,
        keepalive: true
      });
    } catch (_) {
      // Swallow — tracking must never break the host page.
    }
  }

  // ── Track ───────────────────────────────────────────────────────────────
  function track() {
    if (!_workspaceId) return; // not initialized yet

    var payload = {
      workspace_id: _workspaceId,
      url:          location.href,
      referrer:     document.referrer || null,
      fingerprint:  fingerprint(),
      session_id:   getSessionId(),
      utm:          getUtms(),
      user_agent:   navigator.userAgent,
      screen:       screen.width + "x" + screen.height,
      language:     navigator.language,
      timezone:     Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp:    new Date().toISOString()
    };
    send(payload);
  }

  // ── Public API ──────────────────────────────────────────────────────────
  // window.nexus('init', 'workspace-uuid')
  // window.nexus('track')  — manually fire a page view
  function nexus(command, arg) {
    switch (command) {
      case "init":
        if (_initialized) return;
        _workspaceId = arg;
        _initialized = true;
        // Auto-track the current page on init
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", track);
        } else {
          track();
        }
        break;
      case "track":
        track();
        break;
    }
  }

  // ── Process queued commands ──────────────────────────────────────────────
  // If the snippet was loaded before this script, commands are queued in
  // window.nexus.q — process them now.
  var q = window.nexus && window.nexus.q;
  window.nexus = nexus;
  if (q && q.length) {
    for (var i = 0; i < q.length; i++) {
      nexus.apply(null, q[i]);
    }
  }
})();
