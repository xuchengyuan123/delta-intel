/* =========================================================
 * simulators.js — 护甲模拟器 / 伤害模拟器
 * 数据：优先取 data.json 的 weapons / armors，缺失时用内置示例数据。
 * 弹甲对抗模型（基于三角洲行动公开机制）：
 *   子弹等级 1~6（常规武器），护甲等级 1~6（data.json 中 armor.protection 即等级）
 *   子弹等级 < 护甲等级：0 肉体伤害，全额甲伤（先破甲才能扣血）
 *   子弹等级 = 护甲等级：50% 肉体伤害，全额甲伤
 *   子弹等级 = 护甲等级 + 1：75% 肉体伤害，全额甲伤
 *   子弹等级 ≥ 护甲等级 + 2：100% 肉体伤害，护甲不受损（完全穿透）
 * ========================================================= */
(function () {
  "use strict";

  var FALLBACK_WEAPONS = [
    { name: "AKM（示例）", dmg: 40, rof: 600, pen: 40, range: 60, ammo: "7.62x39" },
    { name: "M4A1（示例）", dmg: 31, rof: 780, pen: 35, range: 55, ammo: "5.56x45" },
    { name: "ASVAL（示例）", dmg: 34, rof: 900, pen: 50, range: 35, ammo: "9x39" },
    { name: "M250（示例）", dmg: 45, rof: 650, pen: 55, range: 80, ammo: "7.62x51" },
    { name: "SR-25（示例）", dmg: 80, rof: 60, pen: 58, range: 150, ammo: "7.62x51" },
    { name: "M700（示例）", dmg: 95, rof: 45, pen: 60, range: 200, ammo: "7.62x51" },
    { name: "Vector（示例）", dmg: 27, rof: 1100, pen: 28, range: 30, ammo: "9x19" }
  ];
  var FALLBACK_ARMORS = [
    { name: "轻型战术背心（示例）", durability: 50, protection: 1, tier: "Ⅰ级", repairable: true, material: "芳纶" },
    { name: "标准防弹衣（示例）", durability: 70, protection: 2, tier: "Ⅱ级", repairable: true, material: "陶瓷" },
    { name: "重型防弹衣（示例）", durability: 95, protection: 3, tier: "Ⅲ级", repairable: true, material: "复合陶瓷" },
    { name: "精英防弹背心（示例）", durability: 120, protection: 4, tier: "Ⅳ级", repairable: true, material: "聚乙烯+陶瓷" },
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
  function bulletLevelOpts(sel) {
    var html = "";
    for (var i = 1; i <= 6; i++) {
      html += '<option value="' + i + '"' + (i === (sel || 1) ? " selected" : "") + ">" + i + "级子弹</option>";
    }
    return html;
  }
  function bar(label, cur, max, color) {
    var pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
    return '<div class="sim-bar"><span class="sim-bar-label">' + label + "</span>" +
      '<div class="sim-bar-track"><div class="sim-bar-fill" style="width:' + pct + "%;background:" + color + '"></div></div>' +
      '<span class="sim-bar-val">' + Math.round(cur) + " / " + max + "</span></div>";
  }

  /* ---------------- 弹甲等级对抗模型 ---------------- */
  function bulletArmorMult(bulletLevel, armorLevel) {
    // 返回 { body: 肉体伤害倍率, armor: 护甲耐久伤害倍率 }
    var bl = Math.max(0, Math.min(7, bulletLevel || 1));
    var al = Math.max(0, Math.min(6, armorLevel || 0));
    if (bl < al) return { body: 0, armor: 1 };          // 低等级弹打不穿，只削甲，0 肉伤
    if (bl === al) return { body: 0.5, armor: 1 };      // 同级：半穿，50% 肉伤
    if (bl === al + 1) return { body: 0.75, armor: 1 }; // 高一级：75% 肉伤
    return { body: 1, armor: 0 };                       // 高两级及以上：完全穿透，护甲不损
  }

  /* ---------------- 护甲模拟器 ---------------- */
  function armorHtml(D) {
    var g = getData(D);
    return '<div class="section-title">护甲模拟器</div>' +
      '<div class="card sim-card">' +
        '<div class="sim-row"><label>护甲</label><select id="armorSel">' + opt(g.armors, 3) + "</select></div>" +
        '<div class="sim-row"><label>子弹等级</label><select id="armorBulletLevel">' + bulletLevelOpts(3) + "</select></div>" +
        '<div class="sim-row"><label>单发伤害</label><input type="number" id="hitDmg" value="35" min="1"></div>' +
        '<div class="sim-row"><label>模拟射击次数</label><input type="number" id="hitCount" value="12" min="1"></div>' +
        '<div class="sim-row"><label>目标生命值</label><input type="number" id="tgtHp" value="100" min="1"></div>' +
      "</div>" +
      '<div class="card" id="armorResult"></div>';
  }
  function armorCalc(D) {
    var g = getData(D);
    var a = g.armors[+document.getElementById("armorSel").value];
    var baseDmg = +document.getElementById("hitDmg").value || 0;
    var count = +document.getElementById("hitCount").value || 0;
    var hp0 = +document.getElementById("tgtHp").value || 0;
    var bulletLevel = +document.getElementById("armorBulletLevel").value || 1;
    var armorLevel = a.protection || 0;

    var dur = a.durability, hp = hp0, brokenAt = 0, absorbedTotal = 0;
    var mult = bulletArmorMult(bulletLevel, armorLevel);

    for (var s = 1; s <= count; s++) {
      if (dur <= 0) {
        hp -= baseDmg;
        if (hp <= 0) { hp = 0; break; }
        continue;
      }

      var armorDmg = baseDmg * mult.armor;
      var bodyDmg = baseDmg * mult.body;

      var actualArmorDmg = Math.min(armorDmg, dur);
      dur -= actualArmorDmg;
      absorbedTotal += actualArmorDmg;

      hp -= bodyDmg;

      if (dur <= 0 && !brokenAt) brokenAt = s;
      if (hp <= 0) { hp = 0; break; }
    }

    var status, statusDetail;
    if (mult.armor === 0) {
      status = "完全穿透";
      statusDetail = "子弹等级≥护甲+2，护甲不损";
    } else if (brokenAt) {
      status = "第 " + brokenAt + " 发破甲";
      statusDetail = "破甲前按等级减伤，破甲后全伤";
    } else {
      status = "未破甲";
      statusDetail = "护甲仍有耐久";
    }

    var el = document.getElementById("armorResult");
    el.innerHTML = '<div class="sim-kpis">' +
        '<div class="kpi"><div class="num">' + status + '</div><div class="label">' + statusDetail + '</div></div>' +
        '<div class="kpi"><div class="num">' + Math.round(absorbedTotal) + '</div><div class="label">护甲累计吸收</div></div>' +
        '<div class="kpi"><div class="num">' + Math.round(hp) + '</div><div class="label">目标剩余生命</div></div>' +
      "</div>" +
      bar("护甲耐久", dur, a.durability, "#19c3a6") +
      bar("目标生命", hp, hp0, "#ff5b5b") +
      '<p class="sim-note">弹甲模型：' + bulletLevel + '级弹 vs ' + armorLevel + '级甲。' +
      (mult.armor === 0 ?
        '高等级弹完全穿透护甲，直接扣血。' :
        '同级=50%肉伤/全甲伤；+1级=75%肉伤/全甲伤；低级=0肉伤/全甲伤。破甲后全额扣血。') +
      '</p>';
  }

  /* ---------------- 伤害模拟器 ---------------- */
  function dmgOut(w, prot, dist, bulletLevel) {
    var mult = bulletArmorMult(bulletLevel, prot);
    var rangeF = 1;
    if (dist > w.range) rangeF = Math.max(0.4, 1 - ((dist - w.range) / 10) * 0.08);
    return { bodyMult: mult.body, armorMult: mult.armor, rangeF: rangeF, out: w.dmg * mult.body * rangeF };
  }
  function weaponReport(w, prot, dist, hp, bulletLevel) {
    var r = dmgOut(w, prot, dist, bulletLevel);
    var dps = r.out * (w.rof / 60);
    var ttk = r.out > 0 ? hp / dps : 0;
    var shots = r.out > 0 ? Math.ceil(hp / r.out) : 0;
    return { bodyMult: r.bodyMult, armorMult: r.armorMult, rangeF: r.rangeF, out: r.out, dps: dps, ttk: ttk, shots: shots };
  }
  function armorHtml2(D) {
    var g = getData(D);
    return '<div class="sim-row"><label>目标护甲</label><select id="tgtArmor">' + opt(g.armors, 3) + "</select></div>" +
      '<div class="sim-row"><label>子弹等级</label><select id="bulletLevel">' + bulletLevelOpts(3) + "</select></div>" +
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
    var bulletLevel = +document.getElementById("bulletLevel").value || 1;
    var armorLevel = a.protection || 0;
    var rA = weaponReport(wA, armorLevel, dist, hp, bulletLevel);

    function row(w, r) {
      return "<tr><td>" + w.name + "</td>" +
        '<td style="text-align:right">' + bulletLevel + '级</td>' +
        '<td style="text-align:right">' + w.dmg + "</td>" +
        '<td style="text-align:right">' + (Math.round(r.out * 10) / 10) + "</td>" +
        '<td style="text-align:right">' + Math.round(r.dps) + "</td>" +
        '<td style="text-align:right">' + (r.ttk > 0 ? (Math.round(r.ttk * 100) / 100) + " s" : (r.out <= 0 ? "无法破甲" : "—")) + "</td>" +
        '<td style="text-align:right">' + (r.out > 0 ? r.shots : "—") + "</td></tr>";
    }

    var html = '<table class="tbl"><thead><tr><th>武器</th><th style="text-align:right">子弹</th><th style="text-align:right">裸伤</th><th style="text-align:right">实伤</th><th style="text-align:right">DPS</th><th style="text-align:right">TTK</th><th style="text-align:right">射击数</th></tr></thead><tbody>' +
      row(wA, rA);
    if (wB) {
      var rB = weaponReport(wB, armorLevel, dist, hp, bulletLevel);
      html += row(wB, rB);
      html += "</tbody></table>";
      var winner = (rA.out <= 0 && rB.out <= 0) ? "均无法破甲" :
        (rA.out <= 0) ? (wB.name + " 可破甲") :
        (rB.out <= 0) ? (wA.name + " 可破甲") :
        (rA.ttk < rB.ttk ? (wA.name + " 更快") : (rA.ttk > rB.ttk ? (wB.name + " 更快") : "持平"));
      html += '<div class="sim-kpis"><div class="kpi"><div class="num">' + winner + '</div><div class="label">击杀速度对比</div></div>' +
        '<div class="kpi"><div class="num">' + Math.round(rA.bodyMult * 100) + "% / " + Math.round(rB.bodyMult * 100) + '%</div><div class="label">穿甲效率 A / B</div></div></div>';
    } else {
      html += "</tbody></table><p class='sim-note'>实伤 = 裸伤 × 肉体伤害系数（" + bulletLevel + "级弹 vs " + armorLevel + "级甲 = " + Math.round(rA.bodyMult * 100) + "%）× 距离衰减。距离 " + dist + "m。</p>";
    }
    document.getElementById("dmgResult").innerHTML = html;
  }

  function reg(D) {
    D.VIEWS.sim_armor = {
      html: function () { return armorHtml(D); },
      init: function () {
        ["armorSel", "armorBulletLevel", "hitDmg", "hitCount", "tgtHp"].forEach(function (id) {
          document.getElementById(id).addEventListener("input", function () { armorCalc(D); });
        });
        armorCalc(D);
      }
    };
    D.VIEWS.sim_damage = {
      html: function () { return damageHtml(D); },
      init: function () {
        ["wA", "wB", "tgtArmor", "bulletLevel", "tgtHealth", "tgtDist"].forEach(function (id) {
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
