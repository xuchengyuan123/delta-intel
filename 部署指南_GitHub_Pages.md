# 部署到 GitHub Pages（免费 · 无需实名 · 国内可访问）

> 适用前提：你已经有一个 GitHub 账号（13+ 用邮箱注册即可，不需要实名、不花钱）。
> 这条路**放弃登录/管理员后台**（因为那需要后端服务器），但**保留"每日自动更新"**：
> 由 GitHub Actions 每天北京时间 06:00 自动跑一次数据更新并重新发布；你也可以随时手动点一下按钮立即更新。

---

## 一、在 GitHub 新建仓库

1. 打开 https://github.com/new
2. **Repository name（仓库名）**：随便起，比如 `delta-intel`
3. **Visibility（可见性）**：选 **Public**（公开，情报站本来就是给大家看的）
4. 勾选 **Add a README file**（可选）
5. 点 **Create repository**

---

## 二、把项目文件传上去（推荐用 GitHub Desktop，不用敲命令）

### 方式 A：GitHub Desktop（图形界面，最省事）
1. 下载安装 https://desktop.github.com/
2. 登录你的 GitHub 账号
3. 点 **File → Clone repository**，选你刚建的 `delta-intel` 仓库，克隆到电脑上（会生成一个空文件夹）
4. 把本项目 `kkrb-clone/` 里的这些内容**复制进**那个克隆下来的文件夹：
   - `public/` 文件夹
   - `.github/` 文件夹（里面是自动更新工作流，**别漏**）
   - `config.json`
   - `demo-data.js`
   - `ingest.js`
   - `transform.js`
   - `package.json`
   - `README.md`
   - `.gitignore`（重要，防止上传不该传的文件）
5. 回到 GitHub Desktop，会看到一堆改动 → 写个说明（如"初始上传"）→ 点 **Commit to main** → 点 **Push origin**

> ⚠️ **千万不要上传** `worker/`、`server.js`、`.wrangler/` 这几个——`.gitignore` 已经帮你挡掉了，只要你没手动强制添加就没事。`.wrangler` 里可能有你的 Cloudflare 登录令牌。

### 方式 B：直接网页拖拽（不想装软件时用）
1. 进入你的仓库页面，点 **Add file → Upload files**
2. 把上面列出的文件/文件夹拖进去（`.github` 是隐藏文件夹，网页上传也能拖）
3. 写说明 → **Commit changes**

---

## 三、开启 Pages（让网站能被访问）

1. 仓库页面点顶部 **Settings（设置）**
2. 左侧点 **Pages**
3. **Build and deployment → Source（源）** 选 **Deploy from a branch**
4. **Branch（分支）** 选 `main`，**Folder（目录）** 选 `/public`
5. 点 **Save**
6. 等 1–2 分钟，页面会显示你的网址：
   ```
   https://你的用户名.github.io/delta-intel/
   ```
   把这个网址发给全班同学即可。

---

## 四、每日自动更新（已经配好了）

- 工作流文件 `.github/workflows/update.yml` 会在**每天北京时间 06:00** 自动运行：拉取数据 → 重写 `data.json` → 提交 → Pages 自动重新发布。
- **手动立即更新**：仓库页点 **Actions** → 选「每日更新三角洲情报台」→ 点 **Run workflow** → **Run**。几十秒后网站就刷新了（代替原来的"管理员后台"按钮）。

---

## 五、怎么换成你自己的真实数据

两种办法，改完点一下 Actions 里的 Run workflow 让它生效：

**办法 1：直接改示例数据**
编辑 `demo-data.js`，把你真实的地图密码、物品利润、子弹利润、制作关系填进去，保存并推送（或本地跑 `node ingest.js` 后推送）。

**办法 2：接你自己的数据源（推荐，真正"每天自动更新"）**
编辑 `config.json`：
```json
{
  "DATA_SOURCE_URL": "https://你的接口地址",
  "DATA_SOURCE_TYPE": "json"
}
```
然后在 `transform.js` 里按你接口的字段做映射（文件里有详细注释）。之后每天自动更新就会拉你的真实数据。

> 注意：`config.json` 里的 `ADMIN_PASSWORD` / `SESSION_SECRET` 等字段是**占位符**、且 GitHub Pages 用不到，放心留在仓库里（不是真密码）。真要登录/后台功能，得走之前的 Cloudflare/VPS 方案（需要花钱或实名）。

---

## 六、常见问题

- **打开是 404？** 检查 Settings → Pages 的 Source 是否设为 `main` 分支 + `/public` 目录；第一次要等 1–2 分钟。
- **地图密码等显示示例数据？** 还没接真实源，现为内置示例；按第五节替换即可。
- **国内打不开？** `*.github.io` 在国内一般可访问；若个别同学打不开，多为本地网络问题，换个网络或稍后重试。
- **想换网址？** 仓库名就是网址一部分；也可在仓库 Settings → Pages 里绑定自己别的域名（需要域名，你目前不打算买）。
