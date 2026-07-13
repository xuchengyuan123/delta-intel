/* 三角洲情报台 · 中英双语框架
 * 用法：
 *   - 在任意元素加 data-i18n="key"，框架会按当前语言替换文字（输入框/文本域替换 placeholder）。
 *   - 默认语言存 localStorage(di_lang)，可选 "zh" / "en"。
 *   - 右下角有语言切换按钮（🇨🇳/EN）。
 * 字典在 DICT 中扩展即可，未翻译的 key 保留原文。
 */
(function () {
  "use strict";
  var DICT = {
    en: {
      "nav_home": "Home", "nav_forum": "Forum", "nav_profile": "Profile", "nav_friends": "Friends",
      "nav_sponsor": "Sponsor", "nav_feedback": "Feedback", "btn_login": "Login", "btn_register": "Register",
      "btn_logout": "Logout", "btn_save": "Save", "btn_send": "Send", "btn_search": "Search", "btn_back": "Back",
      "login_email_ph": "Email or phone", "login_pw_ph": "Password", "login_code_ph": "Code (empty = use password)",
      "reg_pw_ph": "Set password (min 6 chars)", "forum_tip": "Log in with your account to post and reply.",
      "post_title_ph": "Post title", "post_body_ph": "Say something…", "btn_post": "Post",
      "profile_title": "My Profile", "profile_name_ph": "Nickname", "profile_bio_ph": "One-line bio",
      "avatar_ph": "Avatar image URL", "my_posts": "My Posts", "add_friend": "Add Friend", "friends_title": "Friends",
      "online": "Online", "offline": "Offline", "chat_ph": "Type a message…", "search_user_ph": "Search user by id/name",
      "incoming_requests": "Incoming Requests", "no_friend": "No friends yet. Add some!", "lang_tip": "Switch language"
    }
  };
  var lang = (function () { try { return localStorage.getItem("di_lang") || "zh"; } catch (e) { return "zh"; } })();

  function tr(key, fallback) {
    if (lang === "en" && DICT.en[key]) return DICT.en[key];
    return fallback;
  }
  function apply() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var def = el.getAttribute("data-i18n-zh") || el.textContent || "";
      var txt = tr(key, def);
      var tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (el.getAttribute("data-i18n-ph") !== "0") el.setAttribute("placeholder", txt);
      } else {
        el.textContent = txt;
      }
    });
    try { document.documentElement.lang = (lang === "en" ? "en" : "zh-CN"); } catch (e) {}
  }
  function setLang(l) { lang = l; try { localStorage.setItem("di_lang", l); } catch (e) {} apply(); syncBtn(); }
  function toggle() { setLang(lang === "en" ? "zh" : "en"); }
  function syncBtn() { var b = document.getElementById("langToggleI18n"); if (b) b.textContent = (lang === "en" ? "🇨🇳" : "EN"); }

  function ensureToggle() {
    if (document.getElementById("langToggleI18n")) { syncBtn(); return; }
    var btn = document.createElement("button");
    btn.id = "langToggleI18n";
    btn.title = "切换语言 / Switch language";
    btn.textContent = (lang === "en" ? "🇨🇳" : "EN");
    btn.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:9999;width:44px;height:44px;border-radius:50%;" +
      "border:1px solid var(--border,#333);background:var(--card,#1c1c22);color:var(--text,#eee);font-size:14px;cursor:pointer;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.35);";
    btn.addEventListener("click", function () { toggle(); });
    document.body.appendChild(btn);
  }

  window.I18N = { setLang: setLang, toggle: toggle, getLang: function () { return lang; }, apply: apply };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { ensureToggle(); apply(); });
  else { ensureToggle(); apply(); }
})();
