/* =========================================================
 * art.js — 建筑线描图案（覆盖 app.js 的 mapArt）
 * 风格：浅灰蓝图底 + 青绿线稿，贴近原站“地图卡片花纹”。
 * 若你有原站精确截图，把图发我即可替换成像素级一致的 SVG。
 * ========================================================= */
(function () {
  "use strict";

  function svgWrap(inner) {
    var grid = 'stroke="rgba(25,195,166,.07)" stroke-width="1" fill="none"';
    var g = "";
    for (var x = 0; x <= 160; x += 16) g += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="120" ' + grid + '/>';
    for (var y = 0; y <= 120; y += 16) g += '<line x1="0" y1="' + y + '" x2="160" y2="' + y + '" ' + grid + '/>';
    return '<svg viewBox="0 0 160 120" class="map-art" preserveAspectRatio="xMidYMid meet">' +
      '<g>' + g + '</g>' + inner + "</svg>";
  }
  function S(color) {
    color = color || "rgba(25,195,166,.5)";
    return 'stroke="' + color + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  }
  function F(color) {
    color = color || "rgba(25,195,166,.5)";
    return 'fill="' + color + '" fill-opacity=".10" stroke="' + color + '" stroke-width="1.6" stroke-linejoin="round"';
  }

  var ART = {
    // 零号大坝：弧形坝体 + 泄洪孔 + 水面 + 输电塔
    "大坝": function () {
      var s = S(), f = F();
      return svgWrap(
        '<path ' + f + ' d="M14 84 Q60 52 104 70 T150 58 L150 96 L14 96 Z"/>' +
        '<path ' + s + ' d="M14 84 Q60 52 104 70 T150 58"/>' +
        '<g ' + s + '>' +
        '<rect x="34" y="80" width="6" height="16"/><rect x="58" y="78" width="6" height="18"/>' +
        '<rect x="82" y="76" width="6" height="20"/><rect x="106" y="72" width="6" height="22"/>' +
        '<rect x="130" y="68" width="6" height="26"/></g>' +
        '<path ' + s + ' d="M6 100 Q40 96 80 100 T150 96"/>' +
        '<path ' + s + ' d="M2 108 Q44 104 90 108 T150 104"/>' +
        '<path ' + s + ' d="M0 38 L22 24 L46 32 L72 18 L100 28 L128 16 L150 30"/>' +
        '<g ' + s + '><line x1="120" y1="40" x2="120" y2="70"/><line x1="112" y1="46" x2="128" y2="46"/>' +
        '<line x1="112" y1="56" x2="128" y2="56"/><line x1="112" y1="66" x2="128" y2="66"/></g>'
      );
    },
    // 长弓溪谷：雷达穹顶 + 信号塔 + 起伏山丘 + 河流
    "溪谷": function () {
      var s = S(), f = F();
      return svgWrap(
        '<path ' + f + ' d="M92 60 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0"/>' +
        '<circle cx="92" cy="60" r="22" ' + s + '/>' +
        '<ellipse cx="92" cy="60" rx="22" ry="9" ' + s + '/>' +
        '<line x1="92" y1="38" x2="92" y2="14" ' + s + '/>' +
        '<line x1="70" y1="60" x2="56" y2="60" ' + s + '/>' +
        '<line x1="114" y1="60" x2="128" y2="60" ' + s + '/>' +
        '<g ' + s + '><line x1="38" y1="96" x2="38" y2="34"/>' +
        '<line x1="30" y1="44" x2="46" y2="44"/><line x1="30" y1="54" x2="46" y2="54"/>' +
        '<line x1="30" y1="64" x2="46" y2="64"/><line x1="30" y1="74" x2="46" y2="74"/>' +
        '<line x1="28" y1="34" x2="48" y2="34"/></g>' +
        '<path ' + s + ' d="M4 104 Q40 76 80 92 T150 82"/>' +
        '<path ' + s + ' d="M0 114 Q50 98 100 110 T150 102"/>' +
        '<circle cx="38" cy="26" r="4" ' + s + '/>'
      );
    },
    // 航天基地：发射塔 + 火箭 + 尾焰 + 龙门吊
    "航天": function () {
      var s = S(), f = F();
      return svgWrap(
        '<path ' + f + ' d="M70 96 L70 30 L90 30 L90 96 Z"/>' +
        '<rect x="70" y="30" width="20" height="66" ' + s + '/>' +
        '<path ' + s + ' d="M80 30 L72 14 L80 22 L88 14 Z"/>' +
        '<g ' + s + '>' +
        '<line x1="52" y1="96" x2="52" y2="42"/><line x1="108" y1="96" x2="108" y2="42"/>' +
        '<line x1="52" y1="56" x2="108" y2="56"/><line x1="52" y1="72" x2="108" y2="72"/>' +
        '<line x1="52" y1="86" x2="108" y2="86"/></g>' +
        '<path ' + s + ' d="M68 96 L74 112 L86 112 L92 96"/>' +
        '<path ' + f + ' d="M74 112 Q80 124 86 112 Z"/>' +
        '<path ' + s + ' d="M16 102 Q50 86 92 96 T150 90"/>'
      );
    },
    // 巴克什：塔楼 + 拱门 + 穹顶（要塞风）
    "巴克": function () {
      var s = S(), f = F();
      return svgWrap(
        '<path ' + f + ' d="M30 104 L30 58 L46 58 L46 104 Z"/>' +
        '<rect x="30" y="58" width="16" height="46" ' + s + '/>' +
        '<path ' + s + ' d="M30 58 L38 40 L46 58"/>' +
        '<line x1="38" y1="40" x2="38" y2="58" ' + s + '/>' +
        '<g ' + s + '><rect x="56" y="74" width="28" height="30"/>' +
        '<path d="M56 74 Q70 58 84 74"/></g>' +
        '<path ' + f + ' d="M96 104 L96 46 L124 46 L124 104 Z"/>' +
        '<rect x="96" y="46" width="28" height="58" ' + s + '/>' +
        '<path ' + s + ' d="M96 46 L110 26 L124 46"/>' +
        '<line x1="110" y1="26" x2="110" y2="46" ' + s + '/>' +
        '<line x1="64" y1="84" x2="76" y2="84" ' + s + '/>' +
        '<line x1="64" y1="94" x2="76" y2="94" ' + s + '/>'
      );
    },
    // 潮汐监狱：高墙 + 瞭望塔 + 铁丝网 + 岗楼
    "监狱": function () {
      var s = S(), f = F();
      return svgWrap(
        '<path ' + f + ' d="M22 104 L22 50 L138 50 L138 104 Z"/>' +
        '<rect x="22" y="50" width="116" height="54" ' + s + '/>' +
        '<line x1="22" y1="64" x2="138" y2="64" ' + s + '/>' +
        '<line x1="22" y1="80" x2="138" y2="80" ' + s + '/>' +
        '<line x1="52" y1="50" x2="52" y2="104" ' + s + '/>' +
        '<line x1="100" y1="50" x2="100" y2="104" ' + s + '/>' +
        '<path ' + f + ' d="M66 50 L66 24 L94 24 L94 50 Z"/>' +
        '<rect x="66" y="24" width="28" height="26" ' + s + '/>' +
        '<path ' + s + ' d="M66 24 L80 12 L94 24"/>' +
        '<line x1="10" y1="50" x2="150" y2="50" ' + s + '/>' +
        '<g ' + s + '><line x1="10" y1="50" x2="10" y2="45"/><line x1="30" y1="50" x2="30" y2="45"/>' +
        '<line x1="50" y1="50" x2="50" y2="45"/><line x1="110" y1="50" x2="110" y2="45"/>' +
        '<line x1="130" y1="50" x2="130" y2="45"/><line x1="150" y1="50" x2="150" y2="45"/></g>'
      );
    },
    // AZ3 核电站：冷却塔 + 厂房 + 烟囱 + 围栏
    "核电": function () {
      var s = S(), f = F();
      return svgWrap(
        '<path ' + f + ' d="M34 104 Q34 56 50 30 Q66 56 66 104 Z"/>' +
        '<path ' + s + ' d="M34 104 Q34 56 50 30 Q66 56 66 104"/>' +
        '<ellipse cx="50" cy="30" rx="16" ry="4.5" ' + s + '/>' +
        '<path ' + f + ' d="M90 104 Q90 66 106 42 Q122 66 122 104 Z"/>' +
        '<path ' + s + ' d="M90 104 Q90 66 106 42 Q122 66 122 104"/>' +
        '<ellipse cx="106" cy="42" rx="16" ry="4.5" ' + s + '/>' +
        '<path ' + f + ' d="M74 104 L74 74 L138 74 L138 104 Z"/>' +
        '<rect x="74" y="74" width="64" height="30" ' + s + '/>' +
        '<g ' + s + '><line x1="84" y1="74" x2="84" y2="54"/><line x1="128" y1="74" x2="128" y2="54"/>' +
        '<path d="M84 54 Q106 44 128 54"/></g>' +
        '<path ' + s + ' d="M14 108 Q56 98 100 108 T150 102"/>'
      );
    }
  };

  // 通用兜底：建筑剪影
  function generic() {
    var s = S();
    return svgWrap(
      '<circle cx="80" cy="60" r="34" ' + s + '/>' +
      '<line x1="80" y1="26" x2="80" y2="94" ' + s + '/>' +
      '<line x1="46" y1="60" x2="114" y2="60" ' + s + '/>' +
      '<rect x="62" y="46" width="36" height="28" rx="2" ' + s + '/>'
    );
  }

  window.DF_MAP_ART = function (name) {
    var n = String(name || "");
    if (n.indexOf("大坝") > -1) return ART["大坝"]();
    if (n.indexOf("溪谷") > -1 || n.indexOf("长弓") > -1) return ART["溪谷"]();
    if (n.indexOf("航天") > -1) return ART["航天"]();
    if (n.indexOf("巴克") > -1) return ART["巴克"]();
    if (n.indexOf("监狱") > -1 || n.indexOf("潮汐") > -1) return ART["监狱"]();
    if (n.indexOf("AZ3") > -1 || n.indexOf("核") > -1) return ART["核电"]();
    return generic();
  };
})();
