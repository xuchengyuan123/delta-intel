// 多语言（中文 / English）—— 轻量 i18n
// 用法：
//   t("key")                  取当前语言文案，缺失时回退到 key 本身
//   <span data-i18n="key">中文</span>  页面加载后自动替换为当前语言
//   setLang("en"|"zh")        切换语言并持久化到 localStorage
//   getLang()                 读取当前语言（默认 zh，未设置时跟随浏览器）
(function () {
  var DICT = {
    zh: {
      appName: "三角洲情报台",
      heroSub: "每日密码 / 产物利润 / 材料价格 · 一屏看全",
      secMap: "每日地图密码",
      secItems: "高利润制造产物",
      secBullets: "热门子弹利润",
      secEvents: "活动物品需求",
      secMaterials: "高价格浮动制造材料",
      secSponsors: "赞助名单",
      secFeed: "📺 最新内容",
      sponsorEmpty: "暂无赞助者，期待你的支持 💛",
      liveUpdate: "实时更新于",
      refresh: "刷新",
      liveFallback: "（实时源不可用，显示缓存数据）",
      login: "登录",
      logout: "退出",
      register: "注册",
      langLabel: "语言",
      // 登录弹窗
      loginTitle: "登录 / 注册",
      idPlaceholder: "邮箱或手机号",
      pwPlaceholder: "密码（≥12位，含大小写/数字/符号）",
      codePlaceholder: "验证码",
      getCode: "获取验证码",
      sendCodeReg: "发送验证码(注册)",
      switchUser: "我是用户",
      switchAdmin: "我是管理员",
      loginBtn: "登录",
      needVerify: "请先获取验证码",
      // 后台标签
      tabPw: "① 每日密码",
      tabForum: "② 论坛",
      tabData: "③ 数据表格",
      tabIcons: "④ 图标",
      tabFeed: "⑤ 内容",
      tabStaff: "⑥ 账号管理",
      tabSponsors: "⑦ 赞助名单",
      // 后台标签（当前编号方案）
      tabData: "① 数据",
      tabSite: "② 站点",
      tabUi: "③ 界面",
      tabMusic: "④ 音乐",
      tabImages: "⑤ 图片库",
      tabTasks: "⑥ 任务",
      tabForum2: "⑦ 论坛",
      tabStaff2: "⑧ 账号管理",
      tabTables: "⑨ 数据表格",
      tabIcons2: "⑩ 图标",
      tabFeed2: "⑪ 内容",
      tabSponsors2: "⑫ 赞助名单",
      tabCode: "⑬ 代码维护",
      // 后台通用
      save: "保存",
      addRow: "添加一行",
      cfg: "列设置",
      confirmDel: "确认删除？",
      loading: "加载中…",
      // 账号管理
      accEmail: "邮箱",
      accPhone: "手机号",
      accRole: "角色",
      accCreated: "注册时间",
      accStatus: "状态",
      accActions: "操作",
      enable: "启用",
      disable: "禁用",
      del: "删除",
      roleSuper: "总管理员",
      roleSubadmin: "分管理员",
      roleUser: "普通用户",
      // 赞助名单
      spName: "名称",
      spAmount: "金额",
      spNote: "留言",
      spAvatar: "头像",
      // 图标
      iconKey: "键名",
      iconUpload: "上传图片",
      iconBind: "绑定",
      iconList: "图标列表",
      // 内容
      feedTitle: "标题",
      feedType: "类型",
      feedUrl: "链接/地址",
      feedAuthor: "作者",
      feedBody: "正文",
      typeVideo: "视频",
      typeGuide: "攻略",
      typeImage: "图片",
      typeText: "资讯"
    },
    en: {
      appName: "DeltaForce Intel",
      heroSub: "Daily codes / item profit / material prices — all on one screen",
      secMap: "Daily Map Codes",
      secItems: "High-Profit Crafted Items",
      secBullets: "Popular Ammo Profit",
      secEvents: "Event Item Demand",
      secMaterials: "Volatile Material Prices",
      secSponsors: "Sponsors",
      secFeed: "📺 Latest",
      sponsorEmpty: "No sponsors yet — your support is welcome 💛",
      liveUpdate: "Live updated at",
      refresh: "Refresh",
      liveFallback: "(live source unavailable, showing cached data)",
      login: "Login",
      logout: "Logout",
      register: "Register",
      langLabel: "Language",
      loginTitle: "Login / Register",
      idPlaceholder: "Email or phone",
      pwPlaceholder: "Password (>=12 chars, upper+lower+digit+symbol)",
      codePlaceholder: "Code",
      getCode: "Get code",
      sendCodeReg: "Send code (register)",
      switchUser: "I'm a user",
      switchAdmin: "I'm an admin",
      loginBtn: "Login",
      needVerify: "Please get a code first",
      tabPw: "① Daily Codes",
      tabForum: "② Forum",
      tabData: "③ Data Tables",
      tabIcons: "④ Icons",
      tabFeed: "⑤ Content",
      tabStaff: "⑥ Accounts",
      tabSponsors: "⑦ Sponsors",
      tabData: "① Data",
      tabSite: "② Site",
      tabUi: "③ UI",
      tabMusic: "④ Music",
      tabImages: "⑤ Images",
      tabTasks: "⑥ Tasks",
      tabForum2: "⑦ Forum",
      tabStaff2: "⑧ Accounts",
      tabTables: "⑨ Tables",
      tabIcons2: "⑩ Icons",
      tabFeed2: "⑪ Content",
      tabSponsors2: "⑫ Sponsors",
      tabCode: "⑬ Code",
      save: "Save",
      addRow: "Add row",
      cfg: "Columns",
      confirmDel: "Confirm delete?",
      loading: "Loading…",
      accEmail: "Email",
      accPhone: "Phone",
      accRole: "Role",
      accCreated: "Joined",
      accStatus: "Status",
      accActions: "Actions",
      enable: "Enable",
      disable: "Disable",
      del: "Delete",
      roleSuper: "Super admin",
      roleSubadmin: "Sub-admin",
      roleUser: "User",
      spName: "Name",
      spAmount: "Amount",
      spNote: "Note",
      spAvatar: "Avatar",
      iconKey: "Key",
      iconUpload: "Upload image",
      iconBind: "Bind",
      iconList: "Icon list",
      feedTitle: "Title",
      feedType: "Type",
      feedUrl: "URL",
      feedAuthor: "Author",
      feedBody: "Body",
      typeVideo: "Video",
      typeGuide: "Guide",
      typeImage: "Image",
      typeText: "News"
    }
  };

  function getLang() {
    var s = null;
    try { s = localStorage.getItem("di_lang"); } catch (e) {}
    if (s === "zh" || s === "en") return s;
    var nav = (navigator.language || "zh").toLowerCase();
    return nav.indexOf("zh") === 0 ? "zh" : "en";
  }
  function setLang(l) {
    if (l !== "zh" && l !== "en") l = "zh";
    try { localStorage.setItem("di_lang", l); } catch (e) {}
    document.documentElement.setAttribute("lang", l === "zh" ? "zh-CN" : "en");
    applyI18n();
    // 通知各模块语言变了
    try { window.dispatchEvent(new CustomEvent("di:lang", { detail: l })); } catch (e) {}
    return l;
  }
  function t(key, fallback) {
    var d = DICT[getLang()] || DICT.zh;
    if (d[key] != null) return d[key];
    return fallback != null ? fallback : key;
  }
  // 把页面上带 data-i18n 的元素文案替换成当前语言
  function applyI18n() {
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute("data-i18n");
      var txt = t(k);
      if (txt != null) nodes[i].textContent = txt;
    }
    var ph = document.querySelectorAll("[data-i18n-ph]");
    for (var j = 0; j < ph.length; j++) {
      var pk = ph[j].getAttribute("data-i18n-ph");
      var pt = t(pk);
      if (pt != null) ph[j].setAttribute("placeholder", pt);
    }
  }

  // 暴露到全局
  window.I18N = DICT;
  window.t = t;
  window.getLang = getLang;
  window.setLang = setLang;
  window.applyI18n = applyI18n;

  // 首次加载：应用一次
  if (document.readyState !== "loading") {
    setLang(getLang());
  } else {
    document.addEventListener("DOMContentLoaded", function () { setLang(getLang()); });
  }
})();
