# Cloudflare 网页端手动部署教程（中文）

本文面向不想在本地运行 Wrangler 的用户，使用 **Cloudflare Dashboard + GitHub/GitLab 仓库导入（Workers Builds）** 完成部署。

> [!IMPORTANT]
> 本项目是 Rust + Cloudflare Workers + D1 + 静态 Web Vault 资产的组合，不适合直接在 Cloudflare 网页编辑器里粘贴代码部署。网页端推荐做法是：在 Cloudflare 控制台导入你的 Git 仓库，让 Cloudflare 的构建环境执行下载前端、编译 WASM、`wrangler deploy` 等步骤。Cloudflare 官方也建议通过 Git 集成导入仓库，并可在构建配置中设置 build/deploy 命令。

## 一、准备工作

1. **Cloudflare 账号**：需要能使用 Workers、D1、KV；如果要用 R2 附件存储，还需要账号已开通 R2。
2. **GitHub 或 GitLab 账号**：把本项目 Fork 到自己的账号，或上传到自己的私有仓库。
3. **一个可用域名（推荐）**：`wrangler.toml` 默认关闭 `*.workers.dev`，建议绑定自定义域名，避免 `workers.dev` 访问异常。
4. **随机密钥**：提前准备两个长随机字符串，用作 `JWT_SECRET` 和 `JWT_REFRESH_SECRET`。可以用密码管理器生成 32 字节以上的随机值。

## 二、Fork/导入代码仓库

1. 打开本项目仓库页面，点击 **Fork** 到自己的 GitHub/GitLab 账号。
2. 如果你要修改 Worker 名称、数据库名称、是否启用 R2 等，建议先在自己的仓库中修改 `wrangler.toml`，然后提交。
3. 确认 `wrangler.toml` 里生产环境 Worker 名称为：

   ```toml
   name = "warden-worker"
   ```

   如果你在 Cloudflare 控制台创建/导入时使用其他项目名，要保持这里的 `name` 与 Cloudflare Worker 项目名一致，否则 Workers Builds 可能会构建失败。

## 三、创建 D1 数据库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **Storage & databases** → **D1 SQL database**。
3. 点击 **Create database**。
4. 数据库名称建议填写：`vault1`。
5. 创建后进入数据库详情页，记录数据库的 **Database ID**，后面会作为构建变量 `D1_DATABASE_ID` 使用。

### 初始化 D1 表结构

首次部署前，需要把 `sql/schema.sql` 导入 D1：

1. 在你自己的代码仓库中打开 `sql/schema.sql`，复制全部 SQL 内容。
2. 回到 Cloudflare Dashboard 的 D1 数据库详情页。
3. 打开 **Console**（或 SQL 查询控制台）。
4. 粘贴 `sql/schema.sql` 的全部内容并执行。
5. 看到执行成功后再继续部署 Worker。

> [!NOTE]
> 后续项目升级如果新增了 `migrations/*.sql`，网页端手动部署需要你按文件名顺序在 D1 Console 中手动执行新增迁移。生产环境更推荐使用 CLI 或 GitHub Actions 自动执行迁移。

## 四、可选：创建附件存储

本项目附件功能可以使用 KV 或 R2：

### 方案 A：使用默认 KV（无需信用卡，单文件限制较小）

如果要使用 KV 存储附件，请先在 Cloudflare Dashboard 创建 KV namespace，然后把 namespace ID 写入你 Fork 后仓库的 `wrangler.toml`。

1. 进入 **Storage & databases** → **KV**。
2. 点击 **Create namespace**，例如命名为：`warden-attachments-kv`。
3. 进入该 namespace 详情页，复制 **Namespace ID**。
4. 在自己的仓库中编辑 `wrangler.toml`，把生产环境 KV 绑定补完整：

   ```toml
   [[kv_namespaces]]
   binding = "ATTACHMENTS_KV"
   id = "你的 KV Namespace ID"
   ```

5. 如果你也部署 `env.dev`，还需要补充 `[[env.dev.kv_namespaces]]` 的 `id`。

绑定名必须是：

```text
ATTACHMENTS_KV
```

如果你暂时不需要附件功能，可以删除或注释 `wrangler.toml` 中的 KV/R2 绑定，避免因未填写 KV namespace ID 导致部署失败。

### 方案 B：使用 R2（适合较大附件）

1. 进入 **Storage & databases** → **R2**。
2. 点击 **Create bucket**，例如命名为：`warden-attachments`。
3. 在自己的仓库中编辑 `wrangler.toml`，取消 R2 配置注释：

   ```toml
   [[r2_buckets]]
   binding = "ATTACHMENTS_BUCKET"
   bucket_name = "warden-attachments"
   ```

4. 提交修改后再部署。

> [!NOTE]
> R2 优先级高于 KV。配置 R2 后，附件会优先使用 R2。附件功能是可选的；如果你移除 KV 和 R2 绑定，密码库核心功能仍可使用，但附件上传/下载不可用。

## 五、在 Cloudflare 网页端导入仓库部署 Worker

1. 进入 Cloudflare Dashboard → **Workers & Pages**。
2. 点击 **Create application**。
3. 选择 **Import a repository**，点击 **Get started**。
4. 授权并选择你的 GitHub/GitLab 仓库。
5. 选择要部署的分支，通常是 `main`。
6. 项目名称填写 `warden-worker`（或与你 `wrangler.toml` 的 `name` 保持一致）。
7. Root directory 保持仓库根目录（通常留空或 `/`）。
8. 构建设置建议如下。Cloudflare 控制台的命令输入框有长度限制，不要把完整脚本直接粘进去；本仓库已提供短命令脚本。

   **Build command / 构建命令：**

   ```bash
   bash scripts/cloudflare-dashboard-build.sh
   ```

   **Deploy command / 部署命令（如果界面有这个输入框）：**

   ```bash
   bash scripts/cloudflare-dashboard-deploy.sh
   ```

   如果你的 Cloudflare 界面和截图一样只有 **构建命令** 一个输入框，可以填下面这一行，让它先准备前端和 Rust 工具链，再执行部署：

   ```bash
   bash scripts/cloudflare-dashboard-build.sh && bash scripts/cloudflare-dashboard-deploy.sh
   ```

   说明：`scripts/cloudflare-dashboard-build.sh` 会安装/启用 Rust 工具链、添加 `wasm32-unknown-unknown` target，并下载 Web Vault 前端静态文件；`scripts/cloudflare-dashboard-deploy.sh` 会执行 `npx wrangler deploy`。`wrangler.toml` 中的 `[build]` 仍会在 `wrangler deploy` 时安装 `worker-build` 并编译 Rust/WASM。

9. 打开 **Build variables and secrets**，新增构建变量：

   | 名称 | 类型 | 示例 | 说明 |
   | ---- | ---- | ---- | ---- |
   | `D1_DATABASE_ID` | Secret 或 Text | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | D1 数据库 ID；`wrangler.toml` 会用它填充 `database_id`。 |
   | `BW_WEB_VERSION` | Text（可选） | `v2026.3.1` | Web Vault 版本；不填则使用默认值。 |
   | `SKIP_DEPENDENCY_INSTALL` | Text（可选） | `1` | 可跳过 Workers Builds 自动依赖安装，完全使用上面的命令控制构建。 |

10. 保存并点击 **Save and Deploy**。
11. 在构建日志中确认 `wrangler deploy` 成功。如果失败，优先检查：
    - Worker 项目名是否与 `wrangler.toml` 的 `name` 一致。
    - `D1_DATABASE_ID` 是否填错。
    - D1 数据库是否已经创建。
    - Web Vault 下载链接是否能访问。
    - 是否误把长脚本粘到 Cloudflare 的命令输入框；如果提示“构建命令的长度必须在 512 个字符以内”，请改用 `bash scripts/cloudflare-dashboard-build.sh` 或上面的合并短命令。

## 六、部署后配置运行时变量和密钥

Worker 部署成功后，还必须配置运行时变量/密钥，否则服务会因缺少关键配置而无法正常工作。

1. 进入 **Workers & Pages** → 选择你的 `warden-worker`。
2. 进入 **Settings** → **Variables and Secrets**。
3. 点击 **Add**，添加以下变量：

   | 名称 | 类型 | 示例 | 必填 | 说明 |
   | ---- | ---- | ---- | ---- | ---- |
   | `ALLOWED_EMAILS` | Secret 或 Text | `your-email@example.com` | 是 | 允许注册/登录的邮箱，支持 `*@example.com`，多个值用逗号分隔。 |
   | `JWT_SECRET` | Secret | 随机长字符串 | 是 | JWT 签名密钥。 |
   | `JWT_REFRESH_SECRET` | Secret | 随机长字符串 | 是 | 刷新令牌签名密钥。 |
   | `BASE_URL` | Text | `https://vault.example.com` | 否 | 推荐绑定自定义域名后填写，不要带末尾 `/`。 |
   | `DISABLE_USER_REGISTRATION` | Text | `false` | 否 | 如果想在前端显示创建账号按钮，可设为 `false`。 |
   | `PUSH_ENABLED` | Text | `true` | 否 | 仅在你要启用 Bitwarden 官方移动端推送时设置。 |
   | `PUSH_INSTALLATION_ID` | Secret | Bitwarden 提供 | 否 | 仅当 `PUSH_ENABLED=true` 时才需要。 |
   | `PUSH_INSTALLATION_KEY` | Secret | Bitwarden 提供 | 否 | 仅当 `PUSH_ENABLED=true` 时才需要。 |

4. 保存时选择 **Deploy**，让变量生效。

> [!IMPORTANT]
> `ALLOWED_EMAILS`、`JWT_SECRET`、`JWT_REFRESH_SECRET` 是生产环境必需配置。敏感值请使用 `Secret` 类型，不要明文写入仓库。

### 不设置移动端推送变量有什么影响？

如果你不需要 Bitwarden 官方移动端 App 的系统级推送通知，**建议不要设置** `PUSH_ENABLED`、`PUSH_INSTALLATION_ID`、`PUSH_INSTALLATION_KEY`。不设置它们时：

- Web Vault、浏览器扩展、桌面端的登录、解锁、同步和附件等核心功能不受影响。
- WebSocket 实时同步仍由 `NOTIFY_DO` Durable Object 负责，和这两个 Bitwarden 推送密钥不是同一套机制。
- 手机 App 不会收到后台推送通知；通常需要打开 App、手动同步，或等待客户端自己的轮询/下次启动同步。
- 不会影响数据库安全，也不会影响密码库数据的加密/解密。

只有当你明确要启用官方移动端推送时，才同时设置：

```text
PUSH_ENABLED=true
PUSH_INSTALLATION_ID=<从 Bitwarden self-host 页面获取>
PUSH_INSTALLATION_KEY=<从 Bitwarden self-host 页面获取>
```

> [!WARNING]
> 不要只设置 `PUSH_ENABLED=true` 而漏掉 `PUSH_INSTALLATION_ID` 或 `PUSH_INSTALLATION_KEY`。代码会把这种状态视为配置错误：移动端注册/更新推送 token 时可能返回服务端错误，通知发送也会跳过并在日志中记录错误。

## 七、绑定自定义域名（推荐）

`wrangler.toml` 默认：

```toml
workers_dev = false
```

也就是说默认不启用 `*.workers.dev`。建议绑定自己的域名，例如 `vault.example.com`：

1. 在 Cloudflare Dashboard 选择你的站点域名。
2. 进入 **DNS** → **Records**。
3. 添加一条记录：
   - Type：`A`
   - Name：`vault`
   - IPv4 address：`192.0.2.1`（占位地址即可）
   - Proxy status：必须是 **Proxied**（橙色云朵）
4. 进入 **Workers & Pages** → `warden-worker` → **Settings** → **Domains & Routes**。
5. 点击 **Add** → **Route**。
6. Route 填写：`vault.example.com/*`。
7. Zone 选择你的域名，Worker 选择 `warden-worker`。
8. 保存后访问 `https://vault.example.com`。
9. 回到 **Variables and Secrets**，把 `BASE_URL` 设置为 `https://vault.example.com`，并再次部署变量。

## 八、首次登录与客户端配置

1. 打开你的域名，例如：`https://vault.example.com`。
2. 如果你允许注册，使用 `ALLOWED_EMAILS` 中匹配的邮箱创建账号。
3. Bitwarden 桌面端、浏览器扩展或移动端登录时，选择自托管服务器，并填写同一个 URL：

   ```text
   https://vault.example.com
   ```

4. 如果客户端登录、同步、上传附件异常，先看 Worker 的 **Logs** 和 D1 表是否初始化成功。

## 九、常见问题排查

### 1. 构建失败：找不到 D1 database_id

检查 Workers Builds 的 **Build variables and secrets** 是否设置了 `D1_DATABASE_ID`。注意这是构建阶段变量，不是 Worker 运行时变量。

### 2. 服务启动后报缺少环境变量

检查 Worker 的 **Settings** → **Variables and Secrets**，确认已经部署：

```text
ALLOWED_EMAILS
JWT_SECRET
JWT_REFRESH_SECRET
```

添加后必须点击 **Deploy** 才会对当前 Worker 生效。

### 3. 页面能打开，但 API 报错或无法注册

确认你已经在 D1 Console 执行过 `sql/schema.sql`。如果数据库为空，后端接口会因表不存在而失败。

### 4. 自定义域名 404 或没有进入 Worker

检查 DNS 记录必须是 **Proxied**（橙色云朵），并确认 Worker Route 是 `vault.example.com/*`，不是只写 `vault.example.com`。

### 5. 附件上传失败

确认至少有一个附件存储绑定可用：

- KV：绑定名 `ATTACHMENTS_KV`。
- R2：绑定名 `ATTACHMENTS_BUCKET`，bucket 名称与 `wrangler.toml` 一致。

### 6. 后续怎么升级？

1. 将上游代码同步到你的 Fork。
2. 检查是否新增 `migrations/*.sql`，如有，按文件名顺序在 D1 Console 执行。
3. 推送到部署分支，或在 Cloudflare Workers Builds 页面手动触发重新部署。
4. 部署成功后测试 Web Vault 登录、同步和附件功能。

## 参考链接

- [Cloudflare Workers Builds：导入 Git 仓库部署 Worker](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Cloudflare Workers Builds：构建配置、Deploy command、Build variables and secrets](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Cloudflare D1：通过 Dashboard 创建数据库并使用 Console](https://developers.cloudflare.com/d1/get-started/)
- [Cloudflare Workers：在 Dashboard 添加环境变量和 Secrets](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Cloudflare Workers：Bindings 说明](https://developers.cloudflare.com/workers/configuration/bindings/)
- [Cloudflare Workers Builds：构建镜像与预装工具](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)
- [Cloudflare Workers Rust 支持：wasm32 target](https://developers.cloudflare.com/workers/languages/rust/)
