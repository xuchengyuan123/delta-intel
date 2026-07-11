/* =========================================================
 * ingest.js — 每日数据更新（每天跑一次就“更新”了）
 * ---------------------------------------------------------
 * 地图密码：从免费公开接口 tmini.net 实时拉取（每天自动变）
 * 特勤处产物 / 子弹 / 制作树 / 活动物品 / 材料价格：暂无免费接口，用内置示例兜底
 * 输出：public/data.json（GitHub Pages 直接读它）
 *
 * 用法：
 *   node ingest.js          # GitHub Actions / 本地手动跑
 * ========================================================= */

const fs = require("fs");
const path = require("path");
const cfg = require("./config.json");
const demo = require("./demo-data.js");

// 免费公开的《三角洲行动》每日密码接口（JSON、无需 token、每天更新）
const PWD_API = cfg.DATA_SOURCE_URL || "https://tmini.net/api/sjzmm?type=json";

function today() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd + " 更新";
}

// 拉取每日密码，映射成站点需要的 maps: [{ name, code, date }]
async function fetchMaps() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(PWD_API, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    const list = (json && json.data && json.data.passwords) || [];
    const maps = list
      .filter((p) => p && p.map_name && p.password)
      .map((p) => ({
        name: String(p.map_name),
        code: String(p.password),
        date: today(),
      }));
    if (!maps.length) throw new Error("接口返回空密码列表");
    console.log("[ingest] 每日密码拉取成功，共", maps.length, "张地图");
    return maps;
  } catch (e) {
    clearTimeout(t);
    console.warn("[ingest] 密码接口失败，回退示例数据：", e.message);
    return demo.data.maps;
  }
}

async function runIngest() {
  const maps = await fetchMaps();

  // 产物 / 子弹 / 制作树 / 活动物品 / 材料价格暂无免费接口，沿用示例数据
  const data = {
    maps: maps,
    items: demo.data.items,
    bullets: demo.data.bullets,
    craft: demo.data.craft,
    eventItems: demo.data.eventItems,
    materials: demo.data.materials,
    title: cfg.SITE_TITLE || "三角洲情报台",
    source: PWD_API,
    updatedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "public", "data.json");
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log(
    "[ingest] 已写出 ->", outPath,
    "| 地图", data.maps.length,
    "产物", data.items.length,
    "子弹", data.bullets.length,
    "活动", data.eventItems.items.length,
    "材料", data.materials.length
  );
  return data;
}

module.exports = { runIngest };

if (require.main === module) {
  runIngest()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[ingest] 失败：", e);
      process.exit(1);
    });
}
