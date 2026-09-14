/*
 * sandbox-blocker.js  —  LOCAL SANDBOX OUTBOUND FIREWALL
 * ------------------------------------------------------------------
 * MUST be the very first script on the page (before dataLayer + GTM).
 *
 * Purpose: let every GTM tag FIRE (so it shows in GTM Preview / Tag
 * Assistant) while guaranteeing that NOTHING actually leaves this
 * machine to DataHash or any ad platform. Instead of sending, each
 * blocked call is logged to the console as:
 *     [SANDBOX] blocked <method> <url>  { ...payload }
 * so you can read the exact payload each tag WOULD have sent.
 *
 * It patches every outbound channel a pixel can use:
 *   fetch, XMLHttpRequest, navigator.sendBeacon, new Image().src,
 *   <img src>, <script src>, <iframe src>  (via createElement + setAttribute).
 *
 * Only googletagmanager.com (GTM itself + Tag Assistant) and the local
 * origin are allowed through. Everything on the BLOCKLIST is stubbed.
 */
(function () {
  "use strict";

  // Hosts / URL fragments that must NEVER reach the network -----------
  var BLOCK = [
    "s2s.rewaatech.com",              // DataHash NeoTag / dhPixel (first-party CNAME)
    "connect.facebook.net", "facebook.com", "fbcdn.net",
    "analytics.tiktok.com", "tiktok.com", "tiktokcdn.com", "ttcdn",
    "snapchat.com", "sc-static.net",  // tr.snapchat.com, tr6.snapchat.com, etc.
    "ads.linkedin.com", "px.ads.linkedin.com", "licdn.com", "snap.licdn.com",
    "ads-twitter.com", "static.ads-twitter.com", "t.co", "analytics.twitter.com",
    "google-analytics.com", "analytics.google.com",
    "googleads.g.doubleclick.net", "doubleclick.net",
    "google.com/pagead", "google.com.sa/pagead", "google.com/ads", "adservice.google",
    "clarity.ms",                     // Microsoft Clarity
    "zoho.com", "zohopublic.com", "salesiq"
  ];

  // Always-allow (substring match wins over BLOCK) -------------------
  var ALLOW = [
    "googletagmanager.com",           // GTM library + Tag Assistant bridge
    location.host                     // our own local origin (assets, routes)
  ];

  function urlStr(u) {
    try {
      if (typeof u === "string") return u;
      if (u && u.url) return u.url;          // Request object
      if (u && u.href) return u.href;        // URL / anchor
      if (u && u.toString) return u.toString();
    } catch (e) {}
    return String(u);
  }

  function allowed(s) {
    for (var i = 0; i < ALLOW.length; i++) if (s.indexOf(ALLOW[i]) !== -1) return true;
    return false;
  }
  function blocked(s) {
    if (allowed(s)) return false;
    for (var i = 0; i < BLOCK.length; i++) if (s.indexOf(BLOCK[i]) !== -1) return true;
    return false;
  }
  function log(method, url, payload) {
    if (payload !== undefined) console.log("%c[SANDBOX] blocked", "color:#c0392b;font-weight:bold", method, url, payload);
    else console.log("%c[SANDBOX] blocked", "color:#c0392b;font-weight:bold", method, url);
  }

  // ---- fetch ------------------------------------------------------
  var _fetch = window.fetch;
  if (_fetch) {
    window.fetch = function (input, init) {
      var s = urlStr(input);
      if (blocked(s)) {
        log("fetch", s, init && init.body);
        return Promise.resolve(new Response("", { status: 204, statusText: "No Content (sandbox)" }));
      }
      return _fetch.apply(this, arguments);
    };
  }

  // ---- XMLHttpRequest --------------------------------------------
  var _open = XMLHttpRequest.prototype.open;
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__sbUrl = urlStr(url);
    this.__sbBlocked = blocked(this.__sbUrl);
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__sbBlocked) {
      log("xhr", this.__sbUrl, body);
      // Simulate a benign completed request without touching the network.
      var self = this;
      try {
        Object.defineProperty(self, "readyState", { value: 4, configurable: true });
        Object.defineProperty(self, "status", { value: 204, configurable: true });
        Object.defineProperty(self, "responseText", { value: "", configurable: true });
      } catch (e) {}
      setTimeout(function () {
        if (typeof self.onreadystatechange === "function") self.onreadystatechange();
        if (typeof self.onload === "function") self.onload();
        self.dispatchEvent && self.dispatchEvent(new Event("load"));
      }, 0);
      return;
    }
    return _send.apply(this, arguments);
  };

  // ---- navigator.sendBeacon --------------------------------------
  if (navigator.sendBeacon) {
    var _beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      var s = urlStr(url);
      if (blocked(s)) { log("beacon", s, data); return true; }
      return _beacon(url, data);
    };
  }

  // ---- Image() beacons -------------------------------------------
  var _Img = window.Image;
  window.Image = function (w, h) {
    var img = new _Img(w, h);
    try {
      var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
      Object.defineProperty(img, "src", {
        configurable: true,
        get: function () { return d.get.call(img); },
        set: function (v) {
          var s = urlStr(v);
          if (blocked(s)) { log("img", s); return; }
          d.set.call(img, v);
        }
      });
    } catch (e) {}
    return img;
  };
  window.Image.prototype = _Img.prototype;

  // ---- dynamically created <script>/<img>/<iframe> src ------------
  var _create = document.createElement.bind(document);
  document.createElement = function (tag) {
    var el = _create(tag);
    var t = (tag + "").toLowerCase();
    if (t === "script" || t === "img" || t === "iframe") {
      try {
        var proto = t === "script" ? HTMLScriptElement.prototype
                  : t === "img" ? HTMLImageElement.prototype
                  : HTMLIFrameElement.prototype;
        var desc = Object.getOwnPropertyDescriptor(proto, "src");
        Object.defineProperty(el, "src", {
          configurable: true,
          get: function () { return desc.get.call(el); },
          set: function (v) {
            var s = urlStr(v);
            if (blocked(s)) { log(t + ".src", s); return; }
            desc.set.call(el, v);
          }
        });
        var _setAttr = el.setAttribute.bind(el);
        el.setAttribute = function (name, value) {
          if ((name + "").toLowerCase() === "src" && blocked(urlStr(value))) { log(t + "[src]", urlStr(value)); return; }
          return _setAttr(name, value);
        };
      } catch (e) {}
    }
    return el;
  };

  console.log("%c[SANDBOX] outbound firewall active", "color:#27ae60;font-weight:bold",
    "— only googletagmanager.com + local origin allowed; all trackers stubbed & logged.");
})();
