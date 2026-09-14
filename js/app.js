/*
 * app.js — GTM test landing page behaviour.
 * Provides the DOM/dataLayer hooks the imported GTM container expects.
 */
(function () {
  "use strict";

  var UTM_KEYS = ["utm_ca","utm_pl","utm_me","utm_ch","utm_pu","utm_ag","utm_co","utm_cr","keyword"];
  function setCookie(k, v) { document.cookie = k + "=" + encodeURIComponent(v) + ";path=/"; }
  (function seedUtm() {
    var q = new URLSearchParams(location.search);
    UTM_KEYS.forEach(function (k) { if (q.has(k)) setCookie(k, q.get(k)); });
    if (!document.cookie.match(/(^|;\s*)utm_pu=/)) setCookie("utm_pu", "facebook");
  })();

  var form = document.getElementById("main_registration");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var nm = (document.getElementById("form-field-name")  || {}).value || "";
      var ph = (document.getElementById("form-field-mobile")|| {}).value || "";
      var em = (document.getElementById("form-field-email") || {}).value || "";

      setCookie("th_capi_em", em);
      setCookie("th_capi_ph", ph);

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "form_submit",
        user_email: em,
        phone_number: ph,
        uname: nm
      });
      console.log("%c[LAB] form_submit pushed", "color:#9969FF;font-weight:bold",
        { user_email: em, phone_number: ph, uname: nm });

      var btn = form.querySelector('[type="submit"], button');
      if (btn) { btn.disabled = true; btn.textContent = "..."; }
      // relative redirect so it works under a GitHub Pages project subpath
      setTimeout(function () { location.href = "../thank-you/"; }, 400);
    });
  }
})();
