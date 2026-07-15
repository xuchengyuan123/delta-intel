/* 三角洲情报台 Service Worker
 * 策略：
 *  - 应用壳（HTML/JS/CSS/图片等静态资源）缓存优先 → 重复访问秒开，微信内置浏览器尤其受益
 *  - data.json 每日更新 → 走网络优先（有网取最新，无网回退缓存）
 *  - GitHub API 等跨域请求 → 直接走网络
 * 每次大版本更新请同步修改 CACHE 名称与 HTML 里的 sw.js?v= 版本。
 */
const CACHE = "delta-intel-v45";
const SHELL = [
  "index.html",
  "forum.html",
  "ugc.html",
  "profile.html",
  "search.html",
  "kzb.html",
  "music.html",
  "admin.html",
  "friends.html",
  "guns.html",
  "tujian.html",
  "sponsor.html",
  "feedback.html",
  "guns-calc.html",
  "news.html",
  "team.html",
  "zhanji.html",
  "css/style.css",
  "js/site-common.js",
  "js/app.js",
  "js/checkin.js",
  "js/art.js",
  "js/crafting.js",
  "js/simulators.js",
  "js/games.js",
  "js/music.js",
  "js/codex.js",
  "js/addons.js",
  "js/guides.js",
  "js/database.js",
  "js/feedback.js",
  "js/analytics.js",
  "js/liveprice.js",
  "js/mappass.js",
  "data.json"
];

self.addEventListener("install", function (e) {
  self.skipWaiting(); // 立即接管，避免旧 SW 死锁
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isDataJson(url) {
  return /(^|\/)data\.json(\?|$)/.test(url.pathname);
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域（如 GitHub API / QQ音乐）直接走网络

  // data.json：网络优先，失败回退缓存（保证内容新鲜 + 离线可用）
  if (isDataJson(url)) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  // 其余静态资源：缓存优先，后台更新缓存（重复访问极快）
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});

self.addEventListener("message", function (e) {
  if (e.data === "skipWaiting") self.skipWaiting();
});
