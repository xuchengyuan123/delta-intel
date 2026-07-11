/* =========================================================
 * simulators.js — 护甲模拟器 / 伤害模拟器
 * 数据：优先取 data.json 的 weapons / armors，缺失时用内置示例数据。
 * 注：公式均为“易于理解的示例模型”，非游戏精确数值。
 * ========================================================= */
(function () {
  "use strict";

  var FALLBACK_WEAPONS = [
    { name: "AK-12（示例）", dmg: 38, rof: 700, pen: 42, range: 60, ammo: "5.45x39" },
    { name: "M4A1（示例）", dmg: 31, rof: 780, pen: 35, range: 55, ammo: "5.56x45" },
    { name: "ASVAL（示例）", dmg: 34, rof: 900, pen: 50, range: 35, ammo: "9x39" },
    { name: "M250（示例）", dmg: 42, rof: 650, pen: 55, range: 80, ammo: "7.62x51" },
    { name: "M700（示例）", dmg: 95, rof: 45, pen: 60, range: 200, ammo: "7.62x51" },
    { name: "Vector（示例）", dmg: 27, rof: 1100, pen: 28, range: 30, ammo: "9x19" }
  ];
  var FALLBACK_ARMORS = [
    { name: "轻型战术背心（示例）", durability: 50, protection: 22, tier: "Ⅰ级", repairable: true, material: "芳纶" },
    { name: "标准防弹衣（示例）", durability: 70, protection: 32, tier: "Ⅱ级", repairable: true, material: "陶瓷" },
    { name: "重型防弹衣（示例）", durability: 95, protection: 45, tier: "Ⅲ级", repairable: true, material: "复合陶瓷" },
    { name: "精英防弹背心（示例）", durability: 120, protection: 58, tier: "Ⅳ级", repairable: true, material: "聚乙烯+陶瓷" },
    { name: "无护甲（裸血）", durability: 0, protection: 0, tier: "—", repairable: false, material: "—" }
  ];

  function getData(D) {
    var data = D.getData() || {};
    return {
      weapons: (data.weapons && data.weapons.length) ? data.weapons : FALLBACK_WEAPONS,
      armors: (data.armors && data.armors.length) ? data.armors : FALLBACK_ARMORS
    };
  }
  function opt(list, sel) {
    return list.map(function (o, i) {
      return '<option value="' + i + '"' + (i === sel ? " selected" : "") + ">" + o.name + "</option>";
    }).join("");
  }
  function bar(label, cur, max, color) {
    var pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
    return '<div class="sim-bar"><span class="sim-bar-label">' + label + "</span>" +
      '<div class="sim-bar-track"><div class="sim-bar-fill" style="width:' + pct + "%;background:" + color + '"></div></div>' +
      '<span class="sim-bar-val">' + Math.round(cur) + " / " + max + "</span></div>";
  }

  /* ---------------- 护甲模拟器 ---------------- */
  function armorHtml(D) {
    var g = getData(D);
    return '<div class="section-title">护甲模拟器</div>' +
      '<div class="card sim-card">' +
        '<div class="sim-row"><label>护甲</label><select id="armorSel">' + opt(g.armors, 3) + "</select></div>" +
        '<div class="sim-row"><label>单发伤害</label><input type="number" id="hitDmg" value="35" min="1"></div>' +
        '<div class="sim-row"><label>模拟射击次数</label><input type="number" id="hitCount" value="12" min="1"></div>' +
        '<div class="sim-row"><label>目标生命值</label><input type="number" id="tgtHp" value="100" min="1"></div>' +
      "</div>" +
      '<div class="card" id="armorResult"></div>';
  }
  function armorCalc(D) {
    var g = getData(D);
    var a = g.armors[+document.getElementById("armorSel").value];
    var dmg = +document.getElementById("hitDmg").value || 0;
    var count = +document.getElementById("hitCount").value || 0;
    var hp0 = +document.getElementById("tgtHp").value || 0;
    var dur = a.durability, hp = hp0, brokenAt = 0, absorbedTotal = 0, brokeHp = hp0;
    for (var s = 1; s <= count; s++) {
      var absorbed = Math.min(dmg, a.protection, dur);
      dur -= absorbed; absorbedTotal += absorbed;
      hp -= (dmg - absorbed);
      if (dur <= 0 && !brokenAt) { brokenAt = s; brokeHp = hp; }
      if (hp <= 0) { hp = 0; break; }
    }
    var el = document.getElementById("armorResult");
    el.innerHTML = '<div class="sim-kpis">' +
        '<div class="kpi"><div class="num">' + (brokenAt ? ("第 " + brokenAt + " 发") : "未破甲") + '</div><div class="label">护甲破裂时机</div></div>' +
        '<div class="kpi"><div class="num">' + Math.round(absorbedTotal) + '</div><div class="label">护甲累计吸收</div></div>' +
        '<div class="kpi"><div class="num">' + Math.round(hp) + '</div><div class="label">目标剩余生命</div></div>' +
      "</div>" +
      bar("护甲耐久", dur, a.durability, "#19c3a6") +
      bar("目标生命", hp, hp0, "#ff5b5b") +
      '<p class="sim-note">模型：每发先由护甲吸收（上限=护甲值，且不超过剩余耐久）；超出部分扣血。若护甲值为 0 则为裸血承伤。等效承受总伤≈护甲耐久+' + (brokenAt ? "破甲后每发全伤" : "（未破甲）") + "。</p>";
  }

  /* ---------------- 伤害模拟器 ---------------- */
  function dmgOut(w, prot, dist) {
    var penF = (w.pen >= prot) ? 1 : (prot > 0 ? w.pen / prot : 1);
    var rangeF = 1;
    if (dist > w.range) rangeF = Math.max(0.4, 1 - ((dist - w.range) / 10) * 0.08);
    return { penF: penF, rangeF: rangeF, out: w.dmg * penF * rangeF };
  }
  function weaponReport(w, prot, dist, hp) {
    var r = dmgOut(w, prot, dist);
    var dps = r.out * (w.rof / 60);
    var ttk = r.out > 0 ? hp / dps : 0;
    var shots = r.out > 0 ? Math.ceil(hp / r.out) : 0;
    return { r: r, dps: dps, ttk: ttk, shots: shots };
  }
  function armorHtml2(D) {
    var g = getData(D);
    return '<div class="sim-row"><label>目标护甲</label><select id="tgtArmor">' + opt(g.armors, 3) + "</select></div>" +
      '<div class="sim-row"><label>目标生命值</label><input type="number" id="tgtHealth" value="100" min="1"></div>' +
      '<div class="sim-row"><label>交战距离 (m)</label><input type="number" id="tgtDist" value="40" min="0"></div>';
  }
  function damageHtml(D) {
    var g = getData(D);
    return '<div class="section-title">伤害 / TTK 模拟器</div>' +
      '<div class="sim-compare">' +
        '<div class="card sim-card"><h4>武器 A</h4>' +
          '<div class="sim-row"><label>武器</label><select id="wA">' + opt(g.weapons, 0) + "</select></div></div>" +
        '<div class="card sim-card"><h4>武器 B（可选）</h4>' +
          '<div class="sim-row"><label>武器</label><select id="wB"><option value="-1">— 不对比 —</option>' + opt(g.weapons, 1) + "</select></div></div>" +
      "</div>" +
      '<div class="card sim-card">' + armorHtml2(D) + "</div>" +
      '<div class="card" id="dmgResult"></div>';
  }
  function damageCalc(D) {
    var g = getData(D);
    var wA = g.weapons[+document.getElementById("wA").value];
    var bv = +document.getElementById("wB").value;
    var wB = bv >= 0 ? g.weapons[bv] : null;
    var a = g.armors[+document.getElementById("tgtArmor").value];
    var hp = +document.getElementById("tgtHealth").value || 100;
    var dist = +document.getElementById("tgtDist").value || 0;
    var prot = a.protection;
    var rA = weaponReport(wA, prot, dist, hp);
    function row(w, r) {
      return "<tr><td>" + w.name + "</td>" +
        '<td style="text-align:right">' + w.dmg + "</td>" +
        '<td style="text-align:right">' + Math.round(r.out * 10) / 10 + "</td>" +
        '<td style="text-align:right">' + Math.round(r.dps) + "</td>" +
        '<td style="text-align:right">' + (r.ttk > 0 ? (Math.round(r.ttk * 100) / 100) + " s" : "—") + "</td>" +
        '<td style="text-align:right">' + r.shots + "</td></tr>";
    }
    var html = '<table class="tbl"><thead><tr><th>武器</th><th style="text-align:right">裸伤</th><th style="text-align:right">实伤</th><th style="text-align:right">DPS</th><th style="text-align:right">TTK</th><th style="text-align:right">射击数</th></tr></thead><tbody>' +
      row(wA, rA);
    if (wB) {
      var rB = weaponReport(wB, prot, dist, hp);
      html += row(wB, rB);
      html += "</tbody></table>";
      var winner = rA.ttk === 0 ? "A（瞬杀）" : rB.ttk === 0 ? "B（瞬杀）" : (rA.ttk < rB.ttk ? (wA.name + " 更快") : (rA.ttk > rB.ttk ? (wB.name + " 更快") : "持平"));
      html += '<div class="sim-kpis"><div class="kpi"><div class="num">' + winner + '</div><div class="label">击杀速度对比</div></div>' +
        '<div class="kpi"><div class="num">' + Math.round(rA.r.penF * 100) + "% / " + Math.round((wB ? rB.r.penF * 100 : 0)) + '%</div><div class="label">穿甲效率 A / B</div></div></div>';
    } else {
      html += "</tbody></table><p class='sim-note'>实伤 = 裸伤 × 穿甲系数（护甲值 vs 穿甲）× 距离衰减。护甲值 " + prot + "，距离 " + dist + "m。</p>";
    }
    document.getElementById("dmgResult").innerHTML = html;
  }

  /* ---------------- 发票利润计算器（已按需求移除） ---------------- */

  function reg(D) {
    D.VIEWS.sim_armor = {
      html: function () { return armorHtml(D); },
      init: function () {
        ["armorSel", "hitDmg", "hitCount", "tgtHp"].forEach(function (id) {
          document.getElementById(id).addEventListener("input", function () { armorCalc(D); });
        });
        armorCalc(D);
      }
    };
    D.VIEWS.sim_damage = {
      html: function () { return damageHtml(D); },
      init: function () {
        ["wA", "wB", "tgtArmor", "tgtHealth", "tgtDist"].forEach(function (id) {
          document.getElementById(id).addEventListener("input", function () { damageCalc(D); });
          document.getElementById(id).addEventListener("change", function () { damageCalc(D); });
        });
        damageCalc(D);
      }
    };
    D.MENU.push({
      group: "模拟器", items: [
        { route: "sim_armor", label: "护甲模拟器", ico: "🛡" },
        { route: "sim_damage", label: "伤害模拟器", ico: "💥" }
      ]
    });
  }
  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
