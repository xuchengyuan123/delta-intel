/* =========================================================
 * profit.js — 净收益结算器（本地工具）
 * 录入本局舔到的物资与单价、入场成本，自动算净收益。战绩存 localStorage。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}
  function fmt(n){return Number(n||0).toLocaleString();}
  var LS = "df_profit_records";

  function load() { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }

  function reg(D) {
    D.VIEWS.profit = {
      html: function () {
        return '<div class="section-title">净收益结算器</div>' +
          '<p class="guide-intro">录入本局舔到的物资与单价、以及入场成本（装备造价/门票），自动算净收益。战绩保存在本地浏览器，不上传。</p>' +
          '<div class="pf-card">' +
            '<div class="pf-cost">' +
              '<label>入场成本（哈夫币）</label>' +
              '<input id="pfCost" type="number" placeholder="如 200000">' +
            '</div>' +
            '<div class="pf-add">' +
              '<input id="pfName" placeholder="物资名（如 海洋之泪）">' +
              '<input id="pfPrice" type="number" placeholder="单价">' +
              '<input id="pfQty" type="number" placeholder="数量" value="1">' +
              '<button class="btn-primary" id="pfAddBtn">+ 添加</button>' +
            '</div>' +
            '<div class="pf-list" id="pfList"><div class="kk-empty">还没添加物资</div></div>' +
            '<div class="pf-sum" id="pfSum"></div>' +
            '<div class="pf-actions">' +
              '<button class="btn-ghost" id="pfSave">保存本局</button>' +
              '<button class="btn-ghost" id="pfClear">清空当前</button>' +
            '</div>' +
          '</div>' +
          '<div class="pf-history"><div class="pf-h-title">战绩记录</div><div id="pfHist"></div></div>';
      },
      init: function () {
        var items = [];
        var listEl = document.getElementById("pfList");
        var sumEl = document.getElementById("pfSum");
        var costEl = document.getElementById("pfCost");

        function renderList() {
          if (!items.length) { listEl.innerHTML = '<div class="kk-empty">还没添加物资</div>'; sumEl.innerHTML = ""; return; }
          listEl.innerHTML = items.map(function (it, i) {
            return '<div class="pf-item">' +
              '<span class="pf-i-name">' + esc(it.name || "未命名") + '</span>' +
              '<span class="pf-i-sub">' + fmt(it.price) + ' × ' + (it.qty || 1) + '</span>' +
              '<span class="pf-i-sub">小计 ' + fmt((it.price || 0) * (it.qty || 1)) + '</span>' +
              '<button class="pf-del btn-ghost" data-i="' + i + '">×</button>' +
            '</div>';
          }).join("");
          document.querySelectorAll("#pfList .pf-del").forEach(function (b) {
            b.addEventListener("click", function () { items.splice(+b.getAttribute("data-i"), 1); renderList(); });
          });
          var gross = items.reduce(function (s, it) { return s + (it.price || 0) * (it.qty || 1); }, 0);
          var cost = Number(costEl.value) || 0;
          var net = gross - cost;
          sumEl.innerHTML = '<div class="pf-line">物资总额：<b>' + fmt(gross) + '</b></div>' +
            '<div class="pf-line">入场成本：<b>' + fmt(cost) + '</b></div>' +
            '<div class="pf-line pf-net ' + (net >= 0 ? 'profit-up' : 'profit-down') + '">净收益：<b>' + fmt(net) + '</b></div>';
        }

        document.getElementById("pfAddBtn").addEventListener("click", function () {
          var name = document.getElementById("pfName").value.trim();
          var price = Number(document.getElementById("pfPrice").value) || 0;
          var qty = Number(document.getElementById("pfQty").value) || 1;
          if (!name || !price) { alert("请填写物资名和单价"); return; }
          items.push({ name: name, price: price, qty: qty });
          document.getElementById("pfName").value = "";
          document.getElementById("pfPrice").value = "";
          document.getElementById("pfQty").value = "1";
          renderList();
        });
        costEl.addEventListener("input", renderList);

        function renderHist() {
          var recs = load();
          var hEl = document.getElementById("pfHist");
          if (!recs.length) { hEl.innerHTML = '<div class="kk-empty">暂无战绩</div>'; return; }
          hEl.innerHTML = recs.slice().reverse().map(function (r, idx) {
            var realIdx = recs.length - 1 - idx;
            return '<div class="pf-h-item">' +
              '<div class="pf-h-top"><span>' + esc(r.date || "") + '</span>' +
              '<span class="' + (r.net >= 0 ? 'profit-up' : 'profit-down') + '">净收益 ' + fmt(r.net) + '</span>' +
              '<button class="pf-h-del btn-ghost" data-i="' + realIdx + '">删除</button></div>' +
              '<div class="pf-h-sub">成本 ' + fmt(r.cost) + ' · 物资 ' + fmt(r.gross) + ' · ' + (r.items ? r.items.length : 0) + ' 件</div>' +
            '</div>';
          }).join("");
          document.querySelectorAll("#pfHist .pf-h-del").forEach(function (b) {
            b.addEventListener("click", function () { var a = load(); a.splice(+b.getAttribute("data-i"), 1); save(a); renderHist(); });
          });
        }

        document.getElementById("pfSave").addEventListener("click", function () {
          if (!items.length) { alert("没有可保存的物资"); return; }
          var gross = items.reduce(function (s, it) { return s + (it.price || 0) * (it.qty || 1); }, 0);
          var cost = Number(costEl.value) || 0;
          var recs = load();
          recs.push({ date: new Date().toLocaleString("zh-CN"), cost: cost, gross: gross, net: gross - cost, items: items.slice() });
          save(recs);
          items = []; renderList(); renderHist();
        });
        document.getElementById("pfClear").addEventListener("click", function () { items = []; renderList(); });

        renderList(); renderHist();
      }
    };
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
