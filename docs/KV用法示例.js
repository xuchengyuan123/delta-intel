/* ============================================================================
 * KV 用法示例（对照 Cloudflare 官方示例风格）
 * ----------------------------------------------------------------------------
 * ⚠️ 本文件【仅供写法对照 / 学习】，请勿用它覆盖 cloudflare/worker.js ！
 *
 * 你的 worker.js 里实际引用的 KV 变量名是：
 *     env.ACCESS   （后台「浏览记录 / 真实访问数据」）
 *     env.TEAMS    （战队大厅 / 战队管理）
 *   （其余还有 USERS / SESSIONS / WORKBENCH ... 见 KV绑定清单.md）
 *
 * 如何"绑定"这些 KV：不是在代码里赋值，而是去 Cloudflare 控制台
 *   Worker(delta-intel-auth) → Settings → Bindings → Add → KV namespace
 *   变量名填 ACCESS / TEAMS，选对应命名空间 → Deploy。
 * 绑定后本示例里的 env.ACCESS / env.TEAMS 才会可用。
 * ========================================================================== */

// ===== 官方原示例（变量名 KV）=====
// export default {
//   async fetch(request, env, ctx) {
//     await env.KV.put('KEY', 'VALUE');
//     const value = await env.KV.get('KEY');
//     const allKeys = await env.KV.list();
//     await env.KV.delete('KEY');
//     return new Response(JSON.stringify({ value, allKeys }));
//   }
// }

// ===== 对照改写：把 KV 换成你的 ACCESS =====
export default {
  async fetch(request, env, ctx) {
    // —— ACCESS（浏览记录 / 访问统计）——
    await env.ACCESS.put('KEY', 'VALUE');           // 写
    const value = await env.ACCESS.get('KEY');      // 读
    const allKeys = await env.ACCESS.list();        // 列举
    await env.ACCESS.delete('KEY');                 // 删

    // —— TEAMS（战队）——
    await env.TEAMS.put('t:demo', JSON.stringify({ name: '示例战队', tag: 'ABC' }));
    const team = await env.TEAMS.get('t:demo');     // 返回字符串，需 JSON.parse
    const teamKeys = await env.TEAMS.list();
    await env.TEAMS.delete('t:demo');

    return new Response(
      JSON.stringify({
        accessValue: value,
        accessKeys: allKeys,
        teamValue: team,
        teamKeys: teamKeys,
      }),
    );
  },
};

/* ============================================================================
 * 可选：想验证「控制台绑定有没有成功」？
 * 在你现有的 worker.js 的路由处理里（handle 函数 switch/if 处）临时加一条：
 *
 *   if (path === '/api/_kvcheck') {
 *     return json({
 *       access: !!env.ACCESS,   // true = 已绑定，false = 未绑定
 *       teams:  !!env.TEAMS
 *     });
 *   }
 *
 * 然后重新 Deploy worker.js，浏览器访问 https://api.delta.shopping/api/_kvcheck
 * 看到 { "access": true, "teams": true } 就说明绑定成功了。
 * （验证完记得把这条路由删掉，或留着也无害。）
 * ========================================================================== */
