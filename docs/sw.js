/* 三角洲情报台 Service Worker — 离线缓存静态资源，提升二次访问速度 */
const CACHE = "delta-intel-v1";
const ASSETS = [
  ".",
  "index.html",
  "admin.html",
  "sponsor.html",
  "forum.html",
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
  "js/guides.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS).catch(function () {}); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  // 动态数据实时优先，缓存兜底
  if (req.url.indexOf("data.json") > -1) {
    e.respondWith(fetch(req).catch(function () { return caches.match("data.json"); }));
    return;
  }
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
