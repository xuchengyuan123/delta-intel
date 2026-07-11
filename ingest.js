/* =========================================================
 * ingest.js — 每日数据更新（核心：每天跑一次就“更新”了）
 * 流程：拉取你的数据源 → transform 映射 → 写出 public/data.json
 * 没配数据源时回退到 demo-data.js，保证站点始终有数据。
 *
 * 用法：
 *   node ingest.js              # 作为脚本直接跑（CLI）
 *   require("./ingest").runIngest()  # 被 server.js 的 /api/update 调用
 * ========================================================= */

const fs = require("fs");
const path = require("path");
const cfg = require("./config.json");
const { transform } = require("./transform.js");
const demo = require("./demo-data.js");

async function runIngest() {
  let raw = null;
  let source = "demo (内置示例)";

  if (cfg.DATA_SOURCE_URL) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(cfg.DATA_SOURCE_URL, {
        headers: cfg.SOURCE_HEADERS || {},
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error("HTTP " + res.status);
      raw = await res.json();
      source = cfg.DATA_SOURCE_URL;
      console.log("[ingest] 已从数据源拉取成功");
    } catch (e) {
      console.warn("[ingest] 数据源拉取失败，回退 demo：", e.message);
    }
  } else {
    console.log("[ingest] 未配置 DATA_SOURCE_URL，使用内置示例数据");
  }

  const data = raw ? transform(raw) : demo.data;
  data.updatedAt = new Date().toISOString();
  data.source = source;
  data.title = cfg.SITE_TITLE || "三角洲情报台";

  const outPath = path.join(__dirname, "public", "data.json");
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log("[ingest] 已写出 ->", outPath, "| 地图", data.maps.length, "产物", data.items.length, "子弹", data.bullets.length);
  return data;
}

module.exports = { runIngest };

// 作为脚本直接执行时才自动跑
if (require.main === module) {
  runIngest()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[ingest] 失败：", e);
      process.exit(1);
    });
}
