# Cloudflare Worker KV 绑定清单（delta-intel-auth）

> 结论：worker.js 已引用这些 KV，你只需在控制台把「KV 命名空间挂到 Worker 变量名上」。
> 绑定后**重新 Deploy 一次**（即使 worker.js 没改，也要点一次 Deploy 让绑定生效）。

---

## 一、必须绑的 KV（按依赖强度）

| 变量名（必须一字不差） | 用途 | 不绑的后果 |
|---|---|---|
| `TEAMS` | 战队大厅 / 战队管理 | 「KV 命名空间 TEAMS 未绑定」 |
| `ACCESS` | 后台「浏览记录 / 真实访问数据」面板（访问日志本体） | 面板报错 |
| `PRESENCE` | 浏览记录面板里的「当前在线用户」列表 | **面板直接崩溃**（PRESENCE 未绑时 `listAccess` 抛错；已修代码降级，但仍建议绑以显示在线状态） |

> ⚠️ **重要修订**：浏览记录面板**不只**依赖 ACCESS，还强依赖 PRESENCE（在线状态）。
> 之前只说"两个 KV（ACCESS/TEAMS）"是漏了 PRESENCE——如果你绑了 ACCESS 但浏览记录仍报错，
> 99% 是 `PRESENCE` 没绑。worker.js 已加防御（PRESENCE 未绑时降级为空在线列表，不再整页崩溃），但绑上 PRESENCE 才能看到在线用户。

---

## 二、控制台一步步绑定（手贴 worker.js 的部署方式）

### 第 1 步：创建 KV 命名空间（如果还没有）
1. 打开 <https://dash.cloudflare.com> → 左侧 **Workers & Pages** → 顶部 **KV**（或「存储」→「KV」）。
2. 点 **Create a namespace**（创建命名空间）。
3. 起名（随便，比如 `delta-teams`、`delta-access`），点创建。
4. 记下每个命名空间的 **Namespace ID**（点进去详情能看到，形如 `a1b2c3...`）。
   - 这两个命名空间都按上面建一次，共得到 2 个 ID。

### 第 2 步：挂到 Worker
1. 左边 **Workers & Pages** → 点你的 Worker **`delta-intel-auth`**。
2. 左侧 **Settings**（设置）→ **Bindings**（绑定）。
3. 点 **Add**（添加）→ 选 **KV namespace**（KV 命名空间）。
4. 填写：
   - **Variable name（变量名）**：填 `TEAMS`（严格大写）
   - **KV namespace**：选刚才建的 `delta-teams`
   - 点 **Deploy**（部署）/ **保存**。
5. 再点一次 **Add** → **KV namespace**：
   - **Variable name**：填 `ACCESS`
   - **KV namespace**：选 `delta-access`
   - **Deploy** / **保存**。
6. （建议）同样加 `WORKBENCH` → 选一个新建的 `delta-workbench` 命名空间。

### 第 3 步：重新部署 worker.js
- 回到 Worker **`delta-intel-auth`** → **Editor**（编辑）→ 把 `cloudflare/worker.js` 全文粘贴进代码框 → **Deploy**。
- **关键**：即使代码一行没改，绑定 KV 后也必须 Deploy 一次，绑定才会真正加载。

### 第 4 步：验证
- 打开后台 → 「浏览记录 / 真实访问数据」面板，应不再报「加载失败」。
- 打开前台「战队大厅」，应显示「暂无战队 / 创建战队」，而不是 KV 未绑提示。

---

## 三、完整 KV 变量核对表（对照你控制台已绑清单查漏）

这些**都是 KV 类型**（需在控制台「KV」里建命名空间再绑定），不是普通变量：

| 变量名 | 是否必绑 | 说明 |
|---|---|---|
| `USERS` | 已绑（登录正常说明已绑） | 注册会员 / 管理员账号 |
| `SESSIONS` | 已绑（同上） | 登录会话 Token |
| `CODES` | 建议 | 邮箱验证码 |
| `POSTS` | 建议 | 帖子 / 动态 |
| `ANNOUNCE` | 建议 | 公告 |
| `UGC` | 建议 | 用户投稿 |
| `COMMENTS` | 建议 | 评论 |
| `ACCESS` | **必绑（你缺）** | 浏览记录 / 访问统计 / 风控队列 |
| `PRESENCE` | **必绑（浏览记录在线状态，未绑会让面板崩，已修降级）** | 在线用户列表 |
| `FRIENDS` | 建议 | 好友关系 |
| `MESSAGES` | 建议 | 私信 |
| `AVATARS` | 建议 | 头像 |
| `TEAMS` | **必绑（你缺）** | 战队系统 |
| `WORKBENCH` | 建议 | 零代码工作台结构持久化 |
| `SECURITY` | 可选 | 不绑则复用 `ACCESS` |

> 凡是「建议」的 KV，不绑可能不会直接报错（代码里有容错或走降级），但对应功能数据不会存。
> 如果你登录后台一切正常，说明 `USERS`/`SESSIONS`/`GH_TOKEN`/`REPO`/`SUPER_EMAIL`/`SUPER_PASSWORD` 都已绑好，不用动。

---

## 四、wrangler.toml 参考（仅当你改用 wrangler 部署时）

如果你以后装了 `wrangler`，把下面片段放进项目 `wrangler.toml`，`id` 换成第 1 步拿到的真实 Namespace ID：

```toml
name = "delta-intel-auth"
main = "cloudflare/worker.js"
compatibility_date = "2024-09-23"

# ===== KV 命名空间绑定 =====
[[kv_namespaces]]
binding = "USERS"
id = "你的_USERS_命名空间ID"

[[kv_namespaces]]
binding = "SESSIONS"
id = "你的_SESSIONS_命名空间ID"

[[kv_namespaces]]
binding = "CODES"
id = "你的_CODES_命名空间ID"

[[kv_namespaces]]
binding = "POSTS"
id = "你的_POSTS_命名空间ID"

[[kv_namespaces]]
binding = "ANNOUNCE"
id = "你的_ANNOUNCE_命名空间ID"

[[kv_namespaces]]
binding = "UGC"
id = "你的_UGC_命名空间ID"

[[kv_namespaces]]
binding = "COMMENTS"
id = "你的_COMMENTS_命名空间ID"

[[kv_namespaces]]
binding = "ACCESS"
id = "你的_ACCESS_命名空间ID"

[[kv_namespaces]]
binding = "PRESENCE"
id = "你的_PRESENCE_命名空间ID"

[[kv_namespaces]]
binding = "FRIENDS"
id = "你的_FRIENDS_命名空间ID"

[[kv_namespaces]]
binding = "MESSAGES"
id = "你的_MESSAGES_命名空间ID"

[[kv_namespaces]]
binding = "AVATARS"
id = "你的_AVATARS_命名空间ID"

[[kv_namespaces]]
binding = "TEAMS"
id = "你的_TEAMS_命名空间ID"

[[kv_namespaces]]
binding = "WORKBENCH"
id = "你的_WORKBENCH_命名空间ID"

# SECURITY 可选：不写则自动复用 ACCESS

# ===== 普通 Secret / 变量（不是 KV，用 vars / secrets 配置）=====
# 这些你在控制台已绑（登录正常），不用动：
#   GH_TOKEN, REPO, SUPER_EMAIL, SUPER_PASSWORD
# 其余可选：
#   AI_API_KEY, AI_API_URL, AI_MODEL,
#   EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID,
#   QQ_APPID, QQ_APPKEY, WECHAT_APPID, WECHAT_APPKEY,
#   SMS_GATEWAY, CF_API_TOKEN, CF_ZONE_ID, MAIL, MAIL_FROM,
#   DF_STATS_KEY, ORZICE_TOKEN, LB
```

---

## 五、快速 QA

**Q：`env.TEAMS` 和命名空间名字要一致吗？**
A：不用。命名空间可以叫 `delta-teams`，但绑到 Worker 时的 **Variable name 必须填 `TEAMS`**（代码认的是变量名）。

**Q：绑完还报错？**
A：99% 是忘了第 3 步「重新 Deploy worker.js」。绑定改了必须 Deploy 才生效。

**Q：能一次把所有 KV 都建好吗？**
A：能，而且建议一次建完（见第三节表），避免功能一个个冒红。
