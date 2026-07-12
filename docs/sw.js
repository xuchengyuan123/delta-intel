/* 三角洲情报台 Service Worker
 * 策略：纯透传（不缓存任何应用资源），彻底避免「旧缓存导致页面打不开 / 更新不生效」。
 * 本站数据每日更新（地图密码/实时物价），缓存应用壳反而有害；
 * 仅保留 SW 以支撑 PWA「添加到主屏幕」，所有请求一律走网络。
 * 每次大版本更新请同步修改 CACHE 名称。
 */
const CACHE = "delta-intel-v10";

self.addEventListener("install", function (e) {
  // 立即接管，不等旧标签关闭，避免「旧 SW 死锁」
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// 所有请求直接转发到网络，绝不返回任何旧缓存
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).catch(function () {
      return new Response("", { status: 504, statusText: "offline" });
    })
  );
});

self.addEventListener("message", function (e) {
  if (e.data === "skipWaiting") self.skipWaiting();
});
