/* =========================================================
 * pricetrend.js — 价格走势图
 *
 * 数据：复用 window.DF.livePrice（caiweilv/DeltaForcePrice 真实成交价）。
 * 机制：每次访问本页时，把当前「物品→价格」快照追加进 localStorage，
 *   随时间累积出历史曲线。图表把每个物品的首个值归一化为 100，
 *   纵轴表示相对涨跌（>100 涨，<100 跌）。
 *   ⚠️ 走势由你浏览器本地累积，仅自己可见；首次访问只有 1 个点，
 *      多次访问（或点「记录快照」）后曲线才会丰满。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}
  function fmt(n){return Number(n||0).toLocaleString();}

  var KEY = "df_pricetrend_v1";
  var MAX_SNAPS = 120;
  var MIN_GAP = 30 * 60 * 1000; // 两次自动快照最小间隔 30 分钟
  var PALETTE = ["#ffb300", "#19c3a6", "#3a7bd5", "#e63946", "#7b2cbf", "#2ecc71", "#ff6b6b", "#f59e0b"];
  var TOPN = 8;

  function read() {
    try { var r = localStorage.getItem(KEY); if (r) return JSON.parse(r) || []; } catch (e) {}
    return [];
  }
  function save(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
  }

  // 记录一次快照（来自 livePrice 当前缓存）
  function snapshot(lp) {
    var items = (lp && lp.ready && lp.ready()) || (lp && lp.list && lp.list()) || [];
    var map = {};
    (Array.isArray(items) ? items : []).forEach(function (it) { if (it && it.name) map[it.name] = it.price; });
    if (!Object.keys(map).length) return null;
    var arr = read();
    var last = arr[arr.length - 1];
    if (last && (Date.now() - last.ts) < MIN_GAP) {
      // 太近则更新最后一条，避免堆积
      last.map = map; last.ts = Date.now();
    } else {
      arr.push({ ts: Date.now(), map: map });
      if (arr.length > MAX_SNAPS) arr = arr.slice(arr.length - MAX_SNAPS);
    }
    save(arr);
    return arr;
  }

  function buildChart(history) {
    if (!history || history.length < 2) return "";
    var last = history[history.length - 1].map;
    // 取最新价最高的 TOPN 物品
    var top = Object.keys(last).map(function (k) { return { name: k, price: last[k] }; })
      .sort(function (a, b) { return (b.price || 0) - (a.price || 0); }).slice(0, TOPN);
    var names = top.map(function (t) { return t.name; });

    // 每个物品的相对序列（首值=100）
    var series = names.map(function (n) {
      var vals = [];
      history.forEach(function (h) {
        var v = h.map[n];
        vals.push((v == null) ? null : v);
      });
      // 找到第一个非 null 作为基准
      var base = null;
      for (var i = 0; i < vals.length; i++) { if (vals[i] != null) { base = vals[i]; break; } }
      return {
        name: n,
        base: base,
        pts: vals.map(function (v) { return (v == null || base == null || base === 0) ? null : (v / base * 100); })
      };
    }).filter(function (s) { return s.base != null; });

    if (!series.length) return '<div class="kk-empty">暂无足够数据绘制走势（物品在快照中缺失）</div>';

    // 计算纵轴范围
    var allv = [];
    series.forEach(function (s) { s.pts.forEach(function (v) { if (v != null) allv.push(v); }); });
    var vmin = Math.min.apply(null, allv.concat([95]));
    var vmax = Math.max.apply(null, allv.concat([105]));
    var pad = (vmax - vmin) * 0.12 || 5;
    vmin = Math.floor(vmin - pad); vmax = Math.ceil(vmax + pad);
    if (vmin > 100) vmin = 90; if (vmax < 100) vmax = 110;

    var W = 680, H = 340, L = 44, R = 16, T = 16, B = 46;
    var plotW = W - L - R, plotH = H - T - B;
    var n = history.length;
    function xAt(i) { return L + (n === 1 ? plotW / 2 : plotW * i / (n - 1)); }
    function yAt(v) { return T + plotH * (1 - (v - vmin) / (vmax - vmin)); }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="pt-svg" preserveAspectRatio="xMidYMid meet">';
    // 网格 + Y 轴刻度
    var ticks = 4;
    for (var g = 0; g <= ticks; g++) {
      var v = vmin + (vmax - vmin) * g / ticks;
      var y = yAt(v);
      svg += '<line x1="' + L + '" y1="' + y + '" x2="' + (W - R) + '" y2="' + y + '" stroke="rgba(128,128,128,.18)" stroke-width="1"/>';
      svg += '<text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="var(--muted)">' + Math.round(v) + '</text>';
    }
    // 100 基线
    var yb = yAt(100);
    svg += '<line x1="' + L + '" y1="' + yb + '" x2="' + (W - R) + '" y2="' + yb + '" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 4" opacity=".8"/>';
    svg += '<text x="' + (W - R) + '" y="' + (yb - 4) + '" text-anchor="end" font-size="10" fill="var(--accent)">基准 100</text>';
    // X 轴标签（首/中/尾）
    [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i) {
      if (i < 0 || i >= n) return;
      var d = new Date(history[i].ts);
      var lab = (d.getMonth() + 1) + "/" + d.getDate() + " " + (d.getHours() + "").padStart(2, "0") + ":" + (d.getMinutes() + "").padStart(2, "0");
      svg += '<text x="' + xAt(i) + '" y="' + (H - B + 18) + '" text-anchor="middle" font-size="10" fill="var(--muted)">' + lab + '</text>';
    });
    // 折线
    series.forEach(function (s, si) {
      var color = PALETTE[si % PALETTE.length];
      var dpath = "", started = false;
      s.pts.forEach(function (v, i) {
        if (v == null) { started = false; return; }
        var x = xAt(i), y = yAt(v);
        dpath += (started ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1) + " ";
        started = true;
      });
      svg += '<path d="' + dpath + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linejoin="round"/>';
      // 点 + tooltip
      s.pts.forEach(function (v, i) {
        if (v == null) return;
        var x = xAt(i), y = yAt(v);
        var orig = s.base * v / 100;
        svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="' + color + '"><title>' + esc(s.name) + "：" + fmt(Math.round(orig)) + "（指数 " + Math.round(v) + "）</title></circle>";
      });
    });
    svg += "</svg>";

    // 图例
    var legend = series.map(function (s, si) {
      var cur = s.pts[s.pts.length - 1];
      var chg = cur != null ? Math.round((cur - 100)) : 0;
      var col = chg > 0 ? "#ff4d4f" : (chg < 0 ? "#19c3a6" : "var(--muted)");
      var sign = chg > 0 ? "+" : "";
      return '<div class="pt-leg"><span class="pt-leg-dot" style="background:' + PALETTE[si % PALETTE.length] + '"></span>' +
        '<span class="pt-leg-n">' + esc(s.name) + '</span>' +
        '<span class="pt-leg-c" style="color:' + col + '">' + sign + chg + '%</span></div>';
    }).join("");

    return '<div class="pt-chart">' + svg + '</div><div class="pt-legend">' + legend + '</div>';
  }

  function reg(D) {
    D.VIEWS.pricetrend = {
      html: function () {
        return '<div class="section-title">价格走势图</div>' +
          '<p class="guide-intro">基于「实时物价」真实成交价，把每次访问的价格快照累积进<strong>你浏览器本地</strong>，绘制相对走势（首值=100）。' +
          '走势仅自己可见，不会上传。多次访问或点「记录快照」后曲线会更完整。</p>' +
          '<div class="pt-bar">' +
            '<button class="btn-primary" id="ptSnap">＋ 记录当前快照</button>' +
            '<button class="btn-ghost" id="ptClear">清空我的历史</button>' +
            '<span class="pt-meta" id="ptMeta"></span>' +
          '</div>' +
          '<div class="card" id="ptCard"><div class="kk-empty">加载中…</div></div>';
      },
      init: function () {
        var lp = window.DF && window.DF.livePrice;
        var card = document.getElementById("ptCard");
        var meta = document.getElementById("ptMeta");

        function refresh() {
          var hist = read();
          // 元信息
          if (meta) {
            if (!hist.length) meta.textContent = "还没有任何快照";
            else meta.textContent = "已记录 " + hist.length + " 次快照 · 最新 " + new Date(hist[hist.length - 1].ts).toLocaleString("zh-CN");
          }
          if (!hist.length) {
            card.innerHTML = '<div class="kk-empty">暂无走势数据。点上方「记录当前快照」开始累积（需实时物价可用）。</div>';
            return;
          }
          if (hist.length < 2) {
            // 只有 1 个点：展示当前高价榜，提示继续访问
            var last = hist[hist.length - 1].map;
            var top = Object.keys(last).map(function (k) { return { name: k, price: last[k] }; })
              .sort(function (a, b) { return (b.price || 0) - (a.price || 0); }).slice(0, 12);
            card.innerHTML = '<div class="kk-empty" style="margin-bottom:10px">仅有 1 个快照，趋势需要 2 个以上数据点。下面是当前交易行高价 Top 12：</div>' +
              '<div class="pt-top">' + top.map(function (t) {
                return '<div class="kk-li"><span class="kk-li-n">' + esc(t.name) + '</span><span class="kk-li-v">' + fmt(t.price) + '</span></div>';
              }).join("") + '</div>';
            return;
          }
          card.innerHTML = buildChart(hist);
        }

        // 首屏：若实时物价已就绪，自动记一次快照（受 MIN_GAP 限制）
        function ensureSnapshotThen(cb) {
          if (!lp) { cb(); return; }
          if (lp.ready && lp.ready() && lp.ready().items && lp.ready().items.length) {
            snapshot(lp); cb();
          } else {
            lp.onChange(function () { snapshot(lp); cb(); });
            if (lp.load) lp.load(true);
          }
        }

        ensureSnapshotThen(refresh);

        var snapBtn = document.getElementById("ptSnap");
        if (snapBtn) snapBtn.addEventListener("click", function () {
          if (!lp) { alert("实时物价不可用"); return; }
          var ok = false;
          if (lp.ready && lp.ready() && lp.ready().items) ok = !!snapshot(lp);
          else { lp.load(true).then(function () { snapshot(lp); refresh(); }); }
          refresh();
          snapBtn.textContent = ok ? "已记录 ✓" : "记录中…";
          setTimeout(function () { snapBtn.textContent = "＋ 记录当前快照"; }, 1400);
        });
        var clrBtn = document.getElementById("ptClear");
        if (clrBtn) clrBtn.addEventListener("click", function () {
          if (confirm("确定清空本地累积的价格走势历史？此操作不可恢复。")) {
            try { localStorage.removeItem(KEY); } catch (e) {}
            refresh();
          }
        });
      }
    };
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
