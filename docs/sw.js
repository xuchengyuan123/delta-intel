/* 三角洲情报台 Service Worker — 离线缓存静态资源，提升二次访问速度
 * 策略：关键页面/JS/CSS 永远网络优先，确保新版一上传就生效；
 * 图片/字体等可缓存优先。每次大版本更新请同步修改 CACHE 名称。
 */
const CACHE = "delta-intel-v8";
const ASSETS = [
  ".",
  "index.html",
  "admin.html",
  "sponsor.html",
  "forum.html",
  "feedback.html",
  "data.json",
  "manifest.webmanifest",
  "icon.svg",
  "css/style.css",
  "js/app.js",
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
  "js/mappass.js"
];

// 需要实时优先的关键资源（HTML 和 JS/CSS）
function isNetworkFirst(url) {
  var u = url;
  return u.indexOf(".html") > -1 ||
         u.indexOf(".js") > -1 ||
         u.indexOf(".css") > -1 ||
         u.indexOf("data.json") > -1 ||
         u.indexOf("manifest.webmanifest") > -1;
}

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(ASSETS).catch(function () {});
    }).then(function () {
      self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  // data.json 和 HTML/JS/CSS 永远网络优先，失败再回缓存
  if (isNetworkFirst(req.url)) {
    e.respondWith(
      fetch(req, { cache: "no-store" }).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req);
      })
    );
    return;
  }

  // 其他资源：缓存优先，后台刷新
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});

// 监听 message，让主页面可以手动要求跳过等待
self.addEventListener("message", function (e) {
  if (e.data === "skipWaiting") {
    self.skipWaiting();
  }
});
