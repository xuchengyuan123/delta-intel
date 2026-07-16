/* =========================================================
 * myassets.js — 我的资产 · 背包估值（本地工具）
 * 手动登记武器/配件/材料/收藏品与单价，按分类统计与总估值。仅存 localStorage。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}
  function fmt(n){return Number(n||0).toLocaleString();}
  var LS = "df_myassets";
  var CATS = [
    { k: "weapon", label: "武器" },
    { k: "attach", label: "配件" },
    { k: "material", label: "材料" },
    { k: "collect", label: "收藏品" }
  ];

  function load() { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function reg(D) {
    D.VIEWS.myassets = {
      html: function () {
        return '<div class="section-title">我的资产 · 背包估值</div>' +
          '<p class="guide-intro">手动登记你的武器 / 配件 / 材料 / 收藏品与单价，自动按分类统计与总估值。数据仅存本地浏览器。</p>' +
          '<div class="ma-card">' +
            '<div class="ma-add">' +
              '<select id="maCat">' + CATS.map(function (c) { return '<option value="' + c.k + '">' + c.label + '</option>'; }).join("") + '</select>' +
              '<input id="maName" placeholder="名称">' +
              '<input id="maQty" type="number" placeholder="数量" value="1">' +
              '<input id="maPrice" type="number" placeholder="单价(哈夫币)">' +
              '<button class="btn-primary" id="maAdd">+ 登记</button>' +
            '</div>' +
          '</div>' +
          '<div id="maBody"><div class="kk-empty">还没有登记资产</div></div>';
      },
      init: function () {
        var data = load();
        var body = document.getElementById("maBody");

        function val(o) {
          var s = 0;
          Object.keys(o).forEach(function (k) {
            (o[k] || []).forEach(function (it) { s += (it.qty || 1) * (it.price || 0); });
          });
          return s;
        }

        function render() {
          var total = val(data);
          var html = '<div class="ma-total">总估值：<b>' + fmt(total) + '</b> 哈夫币</div>';
          CATS.forEach(function (c) {
            var arr = data[c.k] || [];
            if (!arr.length) return;
            var subtotal = arr.reduce(function (s, it) { return s + (it.qty || 1) * (it.price || 0); }, 0);
            html += '<div class="ma-cat">' +
              '<div class="ma-cat-h">' + c.label + ' <span class="ma-cat-sub">' + arr.length + ' 项 · ' + fmt(subtotal) + '</span></div>' +
              '<div class="ma-list">' + arr.map(function (it) {
                return '<div class="ma-item">' +
                  '<span class="ma-i-name">' + esc(it.name) + '</span>' +
                  '<span class="ma-i-sub">×' + (it.qty || 1) + '</span>' +
                  '<span class="ma-i-sub">' + fmt(it.price) + '/个</span>' +
                  '<span class="ma-i-sub">小计 ' + fmt((it.qty || 1) * (it.price || 0)) + '</span>' +
                  '<button class="ma-del btn-ghost" data-cat="' + c.k + '" data-id="' + esc(it.id) + '">×</button>' +
                '</div>';
              }).join("") + '</div>' +
            '</div>';
          });
          if (total === 0 && (!data.weapon && !data.attach && !data.material && !data.collect)) html = '<div class="kk-empty">还没有登记资产</div>';
          body.innerHTML = html;
          document.querySelectorAll("#maBody .ma-del").forEach(function (b) {
            b.addEventListener("click", function () {
              var cat = b.getAttribute("data-cat"), id = b.getAttribute("data-id");
              data[cat] = (data[cat] || []).filter(function (it) { return it.id !== id; });
              save(data); render();
            });
          });
        }

        document.getElementById("maAdd").addEventListener("click", function () {
          var cat = document.getElementById("maCat").value;
          var name = document.getElementById("maName").value.trim();
          var qty = Number(document.getElementById("maQty").value) || 1;
          var price = Number(document.getElementById("maPrice").value) || 0;
          if (!name) { alert("请填写名称"); return; }
          data[cat] = data[cat] || [];
          data[cat].push({ id: uid(), name: name, qty: qty, price: price });
          save(data);
          document.getElementById("maName").value = "";
          document.getElementById("maQty").value = "1";
          document.getElementById("maPrice").value = "";
          render();
        });
        render();
      }
    };
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
