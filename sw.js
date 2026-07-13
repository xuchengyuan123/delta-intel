/* DeltaIntel Service Worker v13
 * 策略：应用外壳（HTML/CSS/JS）缓存优先，二次访问秒开（微信内也快）；
 *       data.json 走网络优先 + 缓存兜底，保证数据最新；
 *       跨域资源（GitHub API / CDN）直接走网络。
 */
const CACHE = "delta-intel-v16";
const SHELL = [
  "./",
  "index.html",
  "forum.html",
  "sponsor.html",
  "admin.html",
  "css/style.css",
  "css/admin-responsive.css",
  "js/app.js",
  "js/music.js",
  "js/auth.js",
  "js/i18n.js",
  "manifest.webmanifest"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // 跨域（GitHub API / jsDelivr / EmailJS 等）→ 直接网络
  if (url.origin !== self.location.origin) return;

  // 数据接口 / 实时数据 → 网络优先，失败回退缓存
  if (url.pathname.endsWith("data.json") || url.pathname.indexOf("/api/") === 0) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  // 应用外壳 → 缓存优先，后台静默更新
  e.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
