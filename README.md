# 三角洲情报台 · DeltaIntel

一个**能真正上线、每天自动更新、静态托管即可轻松扛 300+ 人**的《三角洲行动》战区情报站。
架构复刻自 [kkrb.net](https://www.kkrb.net) 的"单壳 + 视图片段"思路，并做了生产化改造，现在带**用户登录**和**管理员后台**。

> 原站名叫"三角洲行动一图流"，这个版本我重新起了品牌名：**三角洲情报台（DeltaIntel）**。想改名字只需改 `config.json` 的 `SITE_TITLE` 和 `public/index.html` 里的 logo 文案。

---

## 这个版本新增了什么

| 能力 | 说明 |
|------|------|
| 🔐 用户登录 | 普通用户可注册 / 登录（账号存在 `data/accounts.json`，密码用 scrypt 加盐哈希，会话用 HMAC 签名 Cookie） |
| 🛡 管理员后台 | 管理员登录后可在网页里**一键触发每日更新**、**手动录入/修正数据**、查看用户列表 |
| 🔌 每日更新接口 | `POST /api/update` —— 这就是"每天更新的端口"，可被 cron、云函数、或任意脚本用密钥调用 |
| 📊 原有页面 | 首页一图流 / 每日地图密码 / 特勤处产物推荐（带利润柱状图）/ 热门子弹利润 / 制作树（GoJS 可拖拽） |

---

## 目录结构

```
kkrb-clone/
├── public/                 # ← 前端（Cloudflare / VPS 都部署它）
│   ├── index.html          #   壳：顶栏 / 左菜单 / 内容区 / 底栏 + 登录/后台弹窗
│   ├── css/style.css
│   ├── js/app.js           #   路由 + 主题 + 各页面 + 用户/管理员鉴权逻辑
│   └── data.json           #   VPS 方案下由 ingest.js 生成；Cloudflare 下由 D1 提供
├── worker/                 # ← Cloudflare 免费方案 后端（ESM，零服务器）
│   ├── index.js            #   路由 + 静态托管 + 每日定时更新
│   ├── auth.js             #   scrypt 密码哈希 + HMAC 会话签名
│   ├── store.js            #   D1 数据库访问（账号 / 站点数据）
│   ├── ingest.js           #   拉取数据源 → 兜底示例数据
│   ├── transform.js        #   ★ 字段映射（你主要改这里，与 VPS 版一致）
│   ├── demo.js             #   兜底示例数据
│   └── package.json
├── migrations/0001_init.sql  # D1 建表语句
├── wrangler.toml         # Cloudflare 部署配置（含每日 cron）
├── server.js / ingest.js / transform.js / demo-data.js / config.json  # ← VPS 方案用（可选）
└── README.md
```

---

## 一、本地跑起来（3 步）

```bash
cd kkrb-clone
node ingest.js     # 生成 public/data.json（当前用内置示例数据）
node server.js     # 启动站点，默认 http://localhost:3000
```

打开浏览器访问 `http://localhost:3000`：
- 点右上角 👤 注册 / 登录一个普通用户；
- 点 🛡 用管理员账号登录后台（见下方默认账号），就能看到"触发每日更新"和"手动改数据"。

> 直接双击 `public/index.html` 会因浏览器策略无法读 `data.json`，**务必通过 `node server.js` 访问**。

### 首次启动的默认管理员

`server.js` 第一次启动会用 `config.json` 里的账号自动建好管理员（存到 `data/accounts.json`）。**上线前务必改掉这些默认值**：

```json
{
  "ADMIN_USERNAME": "admin",
  "ADMIN_PASSWORD": "CHANGE_ME_admin_password",
  "SESSION_SECRET": "CHANGE_ME_session_secret_use_openssl_rand_hex_32",
  "UPDATE_SECRET":  "CHANGE_ME_update_secret_use_openssl_rand_hex_32"
}
```

生成随机密钥的小技巧：`openssl rand -hex 32`，把输出粘进去即可。

---

## 二、接入你自己的数据源（核心）

你之前说"有自己的数据源/接口"。两步接上：

### 1. 告诉程序数据从哪来 — `config.json`
```json
{
  "SITE_TITLE": "三角洲情报台",
  "DATA_SOURCE_URL": "https://你的域名/api/delta-data",
  "SOURCE_HEADERS": { "Authorization": "Bearer xxxxx" },
  "PORT": 3000
}
```

### 2. 把字段对上 — `transform.js`
`ingest.js` 拉到原始 JSON 后调用 `transform(raw)`。把示例字段名改成你接口真实的字段名即可。站点需要的输出结构：
```js
{
  maps:    [{ name, code, date }],
  items:   [{ station, name, profit, price, sell, grade }],
  bullets: [{ name, profit }],
  craft:   { nodes:[{key,text,cat}], links:[{from,to}] }   // 可选
}
```
改完保存，重新跑 `node ingest.js`（或点后台"触发每日更新"），`public/data.json` 就会换成真实数据。

---

## 三、🔌 每日更新接口（你要的"每天更新的端口"）

`POST /api/update` 会重新跑一遍 `ingest.js`（拉数据源→转换→写 data.json），站点立刻刷新。**两种授权方式二选一**：

### 方式 A：用密钥（适合 cron / 云函数 / 外部脚本）
```bash
curl -X POST "https://你的域名/api/update" \
  -H "x-update-secret: CHANGE_ME_update_secret_use_openssl_rand_hex_32"
```

### 方式 B：用管理员会话（适合在后台点按钮）
管理员登录后，后台里的"🔄 触发每日更新"按钮就是调用这个接口。

### 定时每天跑（Linux cron 示例）
```bash
crontab -e
# 每天 06:00 自动更新
0 6 * * * curl -s -X POST "http://127.0.0.1:3000/api/update" -H "x-update-secret: 你的密钥" >> /var/log/delta-update.log 2>&1
```
> 想每小时？改成 `0 * * * *`。频率完全由你控制。

---

## 四、用户 & 管理员 API 一览

| 接口 | 方法 | 说明 | 授权 |
|------|------|------|------|
| `/api/me` | GET | 当前登录态 | 公开 |
| `/api/register` | POST | 注册普通用户 `{username,password}` | 公开 |
| `/api/login` | POST | 普通用户登录 | 公开 |
| `/api/admin/login` | POST | 管理员登录 | 公开 |
| `/api/logout` | POST | 退出 | 登录后 |
| `/api/update` | POST | 触发每日更新 | `x-update-secret` **或** 管理员会话 |
| `/api/admin/data` | POST | 手动覆盖 data.json（传完整 JSON） | 管理员会话 |
| `/api/admin/users` | GET | 用户列表 | 管理员会话 |

密码用 Node 内置 `crypto.scrypt` 加盐哈希，会话 Cookie 用 HMAC-SHA256 签名且 `HttpOnly`。

> 想让**全站内容必须登录才能看**：在 `server.js` 的 `serveStatic` 里加一句"未登录跳转登录页"即可（默认是公开浏览 + 登录为增值，符合校内 300 人自由访问的场景）。

---

## 五、部署（零服务器 · Cloudflare 免费方案，推荐）

你选了"免费 Serverless 保留后台"——这条路**不用买服务器**，**用户登录 / 管理员后台 / 每日更新接口全部保留**。用的是 Cloudflare 三件套：

- **Workers + Assets**：跑后端 API + 托管前端静态文件（同一域名，前端零改动）
- **D1**：免费的 SQLite 数据库，存账号和站点数据
- **Cron Triggers**：免费的定时任务，每天 06:00（北京时间）自动跑更新

> 免费额度对 300 人绰绰有余；Cloudflare 在国内访问也相对稳定。

### 你只需做 4 步（代码我已经全写好了）

**① 建一个免费 Cloudflare 账号**
打开 https://dash.cloudflare.com/sign-up 注册（免费，邮箱 + 手机验证）。

**② 在本机装好工具并登录**
```bash
npm install -g wrangler
wrangler login          # 浏览器弹出 Cloudflare 授权，点允许
```
（你这台机器已装 Node 22，直接能跑。）

**③ 建数据库 + 设置密钥，然后一键部署**
进入 `kkrb-clone/` 目录，依次执行：
```bash
# 1) 创建 D1 数据库，把返回的 id 粘进 wrangler.toml 的 database_id
wrangler d1 create deltaintel

# 2) 建表
wrangler d1 execute deltaintel --remote --file=./migrations/0001_init.sql

# 3) 设置密钥（务必改成你自己的随机值！）
wrangler secret put ADMIN_USERNAME   # 输入管理员账号，如 admin
wrangler secret put ADMIN_PASSWORD   # 输入管理员密码（强密码）
wrangler secret put SESSION_SECRET  # 粘 `openssl rand -hex 32` 的输出
wrangler secret put UPDATE_SECRET    # 粘 `openssl rand -hex 32` 的输出

# 4) 一键部署
wrangler deploy
```
部署完会给你一个 `https://deltaintel.<随机>.workers.dev` 地址，全校同学直接访问即可。

**④（可选）绑自己的域名**
在 Cloudflare 控制台把你的域名（需先接入 Cloudflare，免费）指向这个 Worker，就能用 `你的域名` 访问、并自动获得 HTTPS。不绑域名也能用上面那个 `*.workers.dev` 地址。

### 怎么"每天更新"？——已经自动跑了
- **自动**：`wrangler.toml` 里 `crons = ["0 22 * * *"]` 已配好，每天北京时间 06:00 自动 `ingest` 刷新数据。
- **手动**：管理员后台点"🔄 触发每日更新"按钮（调用 `/api/update`）；或用密钥触发：
  ```bash
  curl -X POST "https://你的地址/api/update" -H "x-update-secret: 你的UPDATE_SECRET"
  ```

### 接你自己的数据源
和 VPS 版一样：在 `worker/transform.js` 把字段对应上（和根目录 `transform.js` 逻辑一致），然后给 Worker 设一个 `DATA_SOURCE_URL` 环境变量（`wrangler secret put DATA_SOURCE_URL`）。没配就一直用示例数据。

### 本地预览（不部署也能看效果）
```bash
wrangler dev --remote      # 本地起一个和线上一致的 Worker，含 D1
```
浏览器开 `http://localhost:8787` 即可，登录 / 后台 / 更新全可用。

---

## 五-B、部署到 VPS（完全自控 · 备选）

> 如果你以后想要**完全自己掌控服务器**（比如数据敏感、要内网、要更高频更新），可以走 VPS 方案。代码已在根目录准备好（`server.js` 等）。

### 容量说明
纯静态前端 + 小 JSON。**1 核 1G 轻量云（¥20–40/月）用 nginx 轻松扛 300 人**，瓶颈在数据源与域名备案，不是算力。

### 上线步骤（腾讯云/阿里云轻量应用服务器，Ubuntu 22.04）
```bash
# 1) 装 Node
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2) 上传代码到 /opt/delta-site，编辑 config.json 改密钥与管理员密码

# 3) 生成数据 + pm2 守护
cd /opt/delta-site && node ingest.js
sudo npm i -g pm2 && pm2 start server.js --name delta && pm2 save && pm2 startup

# 4) nginx 反代（监听 80，转发给 node server.js 的 3000 端口）
sudo apt install -y nginx
```
```nginx
server {
    listen 80; server_name 你的域名;   # 没域名先填服务器公网 IP
    location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
```
```bash
sudo nginx -t && sudo systemctl reload nginx
```
5) 域名解析到服务器 IP 并 ICP 备案；HTTPS 用 `sudo apt install certbot` 免费签。
6) 防火墙只放行 80/443。

完成后全校访问域名：自由浏览、各自注册；你用管理员后台一键更新或手动改数据。

---

## 六、常见问题

| 现象 | 原因 / 解决 |
|------|------|
| 登录后台提示"管理员账号或密码错误" | 确认 `config.json` 的管理员密码，且 `data/accounts.json` 是用该密码初始化的（改了密码需删掉 `data/accounts.json` 重启重新播种） |
| 更新接口返回 401 | 没带 `x-update-secret`，或密钥与 `config.json` 不一致；用管理员会话调用则无需密钥 |
| 页面能开但制作树/图表空白 | Chart.js、GoJS 走 CDN，需联网；离线会降级提示 |
| 数据不更新 | 检查 cron 是否在跑；手动 `curl .../api/update` 或点后台按钮看返回 |
| 双击 index.html 显示加载失败 | 浏览器禁止 `file://` 读 JSON，改用 `node server.js` 或 `wrangler dev` |
| Cloudflare 部署后 `/api/*` 409/401 | 先 `wrangler d1 execute ... --remote --file=./migrations/0001_init.sql` 建表；管理员账号来自 `wrangler secret put ADMIN_*` |
| `wrangler deploy` 报 database_id 错误 | 把 `wrangler d1 create deltaintel` 返回的 id 粘进 `wrangler.toml` 的 `database_id` |
| 想要"内容必须登录才看" | Cloudflare 版在 `worker/index.js` 的 `fetch` 里对 `/` 等路径加登录判断即可（VPS 版见 server.js 注释） |

## 七、下一步可扩展
- 内容登录墙、按班级/年级分组权限；
- 制作树节点加物品图标（GoJS 图文节点）；
- 接 Leaflet 做"地图密码→坐标点"交互地图；
- 管理员后台加"操作日志 / 数据版本回滚"。

> ⚠️ 安全与版权：请用**你自己有权使用的数据源/接口**。直接抓取第三方站点既不稳定也有法律风险，本仓库不提供任何抓取脚本。
