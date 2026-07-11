/* =========================================================
 * feedback.js — 网站反馈页
 * 集中方式：① 邮箱反馈（mailto） ② 第三方表单（iframe 或跳转链接）
 * 配置来自 data.json.feedback：{ email, mailSubject, formUrl, formEmbed, github }
 * 总管理员可在后台「反馈设置」修改邮箱与表单链接。
 * ========================================================= */
(function () {
  "use strict";
  function reg(D) {
    var esc = D.esc;
    function feedbackHtml(o) {
      var f = o.feedback || {};
      var email = f.email || "";
      var subject = f.mailSubject || "三角洲情报台·网站反馈";
      var github = f.github || "";
      var mailHref = email ? ("mailto:" + email + "?subject=" + encodeURIComponent(subject)) : "";

      var formBlock = "";
      if (f.formEmbed) {
        formBlock = '<iframe class="fb-iframe" src="' + esc(f.formEmbed) + '" loading="lazy"></iframe>';
      } else if (f.formUrl) {
        formBlock = '<div class="fb-form-link"><p>或在第三方表单填写（新标签页打开）：</p>' +
          '<a class="btn-primary" href="' + esc(f.formUrl) + '" target="_blank" rel="noopener">➡ 打开反馈表单</a></div>';
      } else {
        formBlock = '<div class="fb-form-link fb-muted"><p>第三方表单尚未配置。总管理员可在后台「反馈设置」填入表单链接 / 嵌入地址。</p></div>';
      }

      var ghBlock = github
        ? '<a class="btn ghost" href="' + esc(github) + '" target="_blank" rel="noopener">🐙 在 GitHub 提 Issue</a>'
        : "";

      return '<div class="section-title">💬 网站反馈</div>' +
        '<p class="guide-intro">遇到问题、想提建议、发现错误？两种方式都能直达我们，反馈会集中到一处统一处理。</p>' +
        '<div class="fb-grid">' +
          '<div class="fb-card">' +
            '<div class="fb-card-h">📧 邮箱反馈</div>' +
            '<p class="fb-card-p">点击下面的按钮，用你的邮件客户端发送反馈（主题已预填）。</p>' +
            (email ? '<a class="btn-primary" href="' + esc(mailHref) + '">✉ 发送邮件给 ' + esc(email) + '</a>'
                   : '<div class="fb-muted">未配置反馈邮箱，请在后台设置。</div>') +
          '</div>' +
          '<div class="fb-card">' +
            '<div class="fb-card-h">📝 第三方表单</div>' +
            '<p class="fb-card-p">适合不想用邮件、直接填表提交。</p>' +
            formBlock +
          '</div>' +
        '</div>' +
        '<div class="fb-foot">' + ghBlock + '</div>';
    }
    D.VIEWS.feedback = { html: function () { return feedbackHtml(D.getData()); } };
    D.MENU.push({ group: "关于", items: [{ route: "feedback", label: "网站反馈", ico: "💬" }] });
  }
  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
