/* =========================================================
 * transform.js — 把“你的数据源”原始结构 映射成 站点数据模型
 * ---------------------------------------------------------
 * 这是你唯一需要根据真实接口改动的文件。
 * ingest.js 拉到原始 JSON 后会调用 transform(raw)，
 * 你只要把下面示例里的字段取值改成你接口真实的字段名即可。
 *
 * 站点数据模型（必须输出这些字段）：
 *   maps:   [{ name, code, date }]                     每日地图密码
 *   items:  [{ station, name, profit, price, sell, grade }]  特勤处产物
 *   bullets:[{ name, profit }]                         子弹利润
 *   craft:  { nodes:[{key,text,cat}], links:[{from,to}] }  制作树
 *     - cat: "product"(最终产物) | "material"(材料)
 *     - grade: "common"|"rare"|"epic"|"legend"（仅用于产物表配色）
 * ========================================================= */

function transform(raw) {
  // ===== 示例：假设你的接口返回如下结构，按需改 =====
  // {
  //   "maps":   [{ "name": "零号大坝", "code": "0213", "date": "2026-07-10 更新" }],
  //   "items":  [{ "station": "防具台", "name": "精英防弹背心", "profit": 29376, "price": 365130, "sell": "晚上11点", "grade": "legend" }],
  //   "bullets":[{ "name": "5.45x39mm BT", "profit": 54782 }],
  //   "craft":  { "nodes": [...], "links": [...] }
  // }

  // 判空兜底，避免单条缺字段导致整页崩
  const maps = Array.isArray(raw.maps) ? raw.maps.map((m) => ({
    name: String(m.name ?? ""),
    code: String(m.code ?? ""),
    date: String(m.date ?? ""),
  })) : [];

  const items = Array.isArray(raw.items) ? raw.items.map((i) => ({
    station: String(i.station ?? ""),
    name: String(i.name ?? ""),
    profit: Number(i.profit ?? 0),
    price: Number(i.price ?? 0),
    sell: String(i.sell ?? ""),
    grade: String(i.grade ?? "common"),
  })) : [];

  const bullets = Array.isArray(raw.bullets) ? raw.bullets.map((b) => ({
    name: String(b.name ?? ""),
    profit: Number(b.profit ?? 0),
  })) : [];

  const craft = raw.craft && Array.isArray(raw.craft.nodes)
    ? { nodes: raw.craft.nodes, links: raw.craft.links || [] }
    : { nodes: [], links: [] };

  return { maps, items, bullets, craft };
}

module.exports = { transform };
