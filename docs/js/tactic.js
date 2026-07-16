/* =========================================================
 * tactic.js — 战术预案生成器
 * 选地图 + 人数 + 目标，模板生成开局方案（出生/路线/分工/撤离）。
 * 地图模板内置，可在后台 mapData 维护。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}

  // 内置地图模板（经验整理，可在后台 mapData 维护）
  var MAPS = {
    "零号大坝": {
      spawn: ["行政楼出生", "水泥厂出生", "酒店出生"],
      route: ["行政楼→主控室摸机密", "水泥厂→变电站", "酒店→后山撤离"],
      note: "大坝物资密集但架点多，建议优先清掉常见架枪位再摸。"
    },
    "长弓溪谷": {
      spawn: ["己方营地", "观景台", "雷达站"],
      route: ["雷达站→通讯塔", "观景台→山庄", "河谷→撤离点"],
      note: "溪谷地形开阔，狙击位多，机动队注意侧翼。"
    },
    "巴克什": {
      spawn: ["北门", "中央广场", "地下"],
      route: ["北门→博物馆", "中央广场→银行", "地下→撤离通道"],
      note: "巴克什建筑复杂，近战多，注意听脚步与门声。"
    },
    "AZ1": {
      spawn: ["A点", "B点"],
      route: ["A→中庭", "B→仓库"],
      note: "小型图节奏快，速战速决。"
    },
    "AZ3核电站": {
      spawn: ["反应堆", "生活区"],
      route: ["反应堆→控制台", "生活区→宿舍"],
      note: "核电高危区，阿萨拉牌盒爆率高。"
    }
  };
  var GOALS = {
    "摸金": "以最快速度摸到高价值物资并撤离，能不打就不打。",
    "做任务": "围绕任务点规划路线，优先完成目标再考虑额外收益。",
    "打架": "主动找人接战，控图抢点，适合练枪与压制对手。",
    "跑刀": "不带装备，只带必要工具，低风险高机动摸小物资。",
    "搬砖": "稳定循环刷固定点位，追求单位时间收益最大化。"
  };
  var TEAM = {
    "单排": " solo 决策全靠自己，谨慎探点。",
    "双排": " 两人互补，一人架枪一人摸。",
    "三排": " 三人小队，分前中后点位推进。",
    "四排": " 满编队，可强开与包夹。"
  };

  function reg(D) {
    D.VIEWS.tactic = {
      html: function () {
        var mapOpts = Object.keys(MAPS).map(function (m) { return '<option value="' + esc(m) + '">' + esc(m) + '</option>'; }).join("");
        var goalOpts = Object.keys(GOALS).map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join("");
        var teamOpts = Object.keys(TEAM).map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join("");
        return '<div class="section-title">战术预案生成器</div>' +
          '<p class="guide-intro">选地图 + 人数 + 目标，一键生成开局预案（出生点 / 路线 / 分工 / 撤离）。模板为经验整理，供参考。</p>' +
          '<div class="tc-bar">' +
            '<select class="tc-sel" id="tcMap"><option value="">选择地图</option>' + mapOpts + '</select>' +
            '<select class="tc-sel" id="tcTeam"><option value="">人数</option>' + teamOpts + '</select>' +
            '<select class="tc-sel" id="tcGoal"><option value="">目标</option>' + goalOpts + '</select>' +
            '<button class="btn-primary" id="tcGen">生成预案</button>' +
          '</div>' +
          '<div id="tcBody"><div class="kk-empty">选择条件后生成</div></div>';
      },
      init: function () {
        document.getElementById("tcGen").addEventListener("click", function () {
          var m = document.getElementById("tcMap").value;
          var t = document.getElementById("tcTeam").value;
          var g = document.getElementById("tcGoal").value;
          if (!m || !t || !g) { document.getElementById("tcBody").innerHTML = '<div class="kk-empty">请完整选择地图 / 人数 / 目标</div>'; return; }
          var tmpl = MAPS[m];
          var html = '<div class="tc-card">' +
            '<div class="tc-h">📋 ' + esc(m) + ' · ' + esc(t) + ' · ' + esc(g) + ' 预案</div>' +
            '<div class="tc-sec"><span class="tc-k">🎯 目标</span><p>' + esc(GOALS[g]) + (TEAM[t] || "") + '</p></div>' +
            '<div class="tc-sec"><span class="tc-k">🚩 可选出生</span><p>' + tmpl.spawn.map(esc).join(" / ") + '</p></div>' +
            '<div class="tc-sec"><span class="tc-k">🗺 推荐路线</span><p>' + tmpl.route.map(function (r) { return "• " + esc(r); }).join("<br>") + '</p></div>' +
            '<div class="tc-sec"><span class="tc-k">🛡 要点提示</span><p>' + esc(tmpl.note) + '</p></div>' +
            '<div class="tc-sec"><span class="tc-k">🏃 撤离</span><p>确认最近撤离点是否开启，预留 30 秒撤离时间，背包满时优先保大红。</p></div>' +
            '<button class="btn-ghost" id="tcCopy">复制预案</button>' +
          '</div>';
          document.getElementById("tcBody").innerHTML = html;
          document.getElementById("tcCopy").addEventListener("click", function () {
            var text = "【" + m + " · " + t + " · " + g + " 预案】\n目标：" + GOALS[g] + TEAM[t] +
              "\n出生：" + tmpl.spawn.join(" / ") +
              "\n路线：\n" + tmpl.route.map(function (r) { return "- " + r; }).join("\n") +
              "\n提示：" + tmpl.note;
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
              else { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
              var b = this; var o = b.textContent; b.textContent = "已复制 ✓"; setTimeout(function () { b.textContent = o; }, 1400);
            } catch (e) {}
          });
        });
      }
    };
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
