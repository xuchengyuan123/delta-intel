/* =========================================================
 * analytics.js — 免费网站浏览统计接入（GoatCounter / Cloudflare Web Analytics）
 *
 * 设计原则（对应需求：真实数据、免费、不要假数据）：
 *  - 本站是纯静态托管（GitHub Pages），没有服务器，无法自己存访客日志。
 *  - 真实访客数据由【免费第三方统计服务】采集，本站只负责两件事：
 *      1) 按 data.json.analytics 配置，在每次访问时注入统计脚本（真实上报）；
 *      2) 提供一个「浏览数据」视图，嵌入服务商的【实时公开看板】（数据真实，非伪造）。
 *  - 未配置（siteId 为空或 enabled=false）时：
 *      不加载任何跟踪脚本、不显示任何数字，只给开通指引 —— 绝不放假数据。
 *
 * 免费服务商（均无需自建服务器）：
 *  - goatcounter（默认）：非商业免费、开源、隐私友好、看板可设为公开。
 *  - cloudflare：Cloudflare Web Analytics，免费，需在 Cloudflare 取 beacon token。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}

  // 按配置注入统计脚本（仅在真正配置后才会执行）
  function inject(cfg) {
    if (!cfg || !cfg.enabled) return;
    var id = (cfg.siteId || "").trim();
    if (!id) return;
    var p = (cfg.provider || "goatcounter");
    try {
      if (p === "goatcounter") {
        var s = document.createElement("script");
        s.async = true;
        s.src = "https://gc.zgo.at/count.js";
        s.dataset.goatcounter = id + ".goatcounter.com";
        document.head.appendChild(s);
      } else if (p === "cloudflare") {
        var sc = document.createElement("script");
        sc.async = true; sc.defer = true;
        sc.src = "https://static.cloudflareinsights.com/beacon.min.js";
        sc.dataset.cfBeacon = JSON.stringify({ token: id });
        document.head.appendChild(sc);
      }
    } catch (e) { /* 静默失败，不影响站点 */ }
  }

  // 数据加载完成后才注入（DATA 由 app.js 异步 fetch）
  function startInjector() {
    var tries = 0;
    (function poll() {
      if (window.__df_an_injected) return;
      var d = window.DF && window.DF.getData && window.DF.getData();
      if (d && d.analytics) {
        window.__df_an_injected = true;
        inject(d.analytics);
        return;
      }
      if (++tries < 80) setTimeout(poll, 150);
    })();
  }

  function reg(D) {
    startInjector();

    D.VIEWS.analytics = {
      html: function () {
        var cfg = (D.getData() && D.getData().analytics) || {};
        var ready = cfg.enabled && (cfg.siteId || "").trim();
        if (!ready) {
          return '<div class="section-title">浏览数据（网站统计）</div>' +
            '<div class="card an-empty">' +
              '<div class="an-empty-ico">📊</div>' +
              '<h3>尚未配置浏览统计</h3>' +
              '<p>本站为纯静态托管，没有服务器，<strong>真实访客数据由免费第三方统计服务采集</strong>，不会在本机造假。</p>' +
              '<p>免费开通步骤（任选其一，均无需自建服务器）：</p>' +
              '<ol class="an-steps">' +
                '<li>注册 <a href="https://www.goatcounter.com" target="_blank" rel="noopener">GoatCounter</a>（非商业免费），创建一个站点，得到形如 <code>你的ID.goatcounter.com</code> 的地址。</li>' +
                '<li>在后台「<a href="admin.html">浏览统计</a>」面板填写：服务商=goatcounter、Site ID=你的ID，并开启「启用」。建议把 GoatCounter 看板设为「公开」，即可在此直接查看实时数据。</li>' +
                '<li>保存后刷新，访客数据即开始真实累计，这里会自动嵌入实时看板。</li>' +
              '</ol>' +
              '<p class="an-note">备选：<a href="https://www.cloudflare.com/web-analytics/" target="_blank" rel="noopener">Cloudflare Web Analytics</a>（免费，需在 Cloudflare 获取 beacon token 填入 Site ID）。</p>' +
            '</div>';
        }
        var pid = (cfg.siteId || "").trim();
        var dash = (cfg.provider === "cloudflare")
          ? "https://www.cloudflare.com/analytics/web/"
          : "https://" + pid + ".goatcounter.com";
        return '<div class="section-title">浏览数据（实时看板）</div>' +
          '<div class="card an-card">' +
            '<div class="an-bar">' +
              '<span class="an-provider">服务商：' + esc(cfg.provider) + ' · ' + esc(pid) + '</span>' +
              '<a class="btn-ghost sm" href="' + esc(dash) + '" target="_blank" rel="noopener">在新标签打开 ↗</a>' +
            '</div>' +
            '<iframe class="an-frame" src="' + esc(dash) + '" title="浏览数据实时看板" loading="lazy"></iframe>' +
            '<p class="an-note">以上为服务商真实采集的实时数据，非本机模拟。若看板提示「需登录 / 未公开」，请到对应服务商后台把看板设为「公开」，或更换为已公开的站点地址；也可点击右上「在新标签打开」直接查看。</p>' +
          '</div>';
      }
    };

    D.MENU.push({ group: "数据中心", items: [{ route: "analytics", label: "浏览数据", ico: "📊" }] });
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
