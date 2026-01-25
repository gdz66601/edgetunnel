# EdgeTunnel D1 用户管理系统使用说明

## 📖 概述

本系统为 EdgeTunnel 添加了基于 Cloudflare D1 的用户管理功能，提供**独立的 Web 管理面板**，实现 UUID 白名单控制、用户过期时间管理和访问记录。

**核心特性**：
- ✅ UUID 白名单控制（只有授权用户才能连接）
- ✅ 用户过期时间自动检查
- ✅ 订阅访问记录
- ✅ 5 分钟内存缓存，性能优化
- ✅ 独立的 Web 管理面板，与原管理面板完全分离
- ✅ 完全向后兼容（D1 未配置时正常运行）

---

## 🚀 快速开始

### 1. 创建 D1 数据库

```bash
cd C:\Users\ZhangFan\Documents\GitHub\edgetunnel
wrangler d1 create edgetunnel_db
```

**输出示例**：
```
✅ Successfully created DB 'edgetunnel_db' in region APAC

[[d1_databases]]
binding = "DB"
database_name = "edgetunnel_db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. 更新 wrangler.toml

复制上面输出的 `database_id`，填入 `wrangler.toml` 的第 10 行：

```toml
# D1 数据库绑定（用户管理系统）
[[d1_databases]]
binding = "DB"
database_name = "edgetunnel_db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # 填入你的 database_id
```

### 3. 执行数据库迁移

```bash
# 生产环境（必须执行）
wrangler d1 execute edgetunnel_db --remote --file=./migrations/0001_initial_schema.sql
```

### 4. 配置环境变量

在 Cloudflare Workers 控制台 > 设置 > 变量和机密 中添加：

| 变量名 | 必填 | 说明 | 示例 |
|--------|:----:|------|------|
| `USER_ADMIN` | ✅ | **用户管理面板密码**（独立密码） | `your-user-admin-password-123` |
| `ADMIN` | ⚠️ | 原管理面板密码（已存在） | `admin-password` |
| `DB` | 自动 | D1 数据库绑定（wrangler.toml 配置） | - |

**重要说明**：
- `USER_ADMIN`：用于访问用户管理面板（`/usermgmt`），与原管理面板密码**完全独立**
- `ADMIN`：用于访问原管理面板（`/admin`），保持不变
- 两个密码互不影响，分别控制不同功能

**设置密码**：
```bash
# 设置用户管理面板密码
wrangler secret put USER_ADMIN
# 输入：your-user-admin-password-123
```

### 5. 部署

```bash
wrangler deploy
```

---

## 🔐 两套管理系统对比

### 原管理面板（/admin）

**访问路径**：`https://your-domain.com/admin`
**认证方式**：Cookie（登录后自动设置）
**密码环境变量**：`ADMIN` 或 `PASSWORD`
**功能**：
- 查看配置文件
- 修改节点配置
- 查看请求日志
- 管理优选 IP

**说明**：原有功能保持不变，继续使用原密码。

---

### 用户管理面板（/usermgmt）

**访问路径**：`https://your-domain.com/usermgmt`
**认证方式**：Cookie（登录后自动设置）
**密码环境变量**：`USER_ADMIN`（**独立密码**）
**功能**：
- 查看所有用户列表
- 添加/编辑/删除用户
- 查看用户订阅记录
- 管理用户过期时间

**说明**：专门用于用户管理，使用独立密码，与原管理面板完全分离。

---

## 💻 用户管理面板使用指南

### 登录

1. 访问 `https://your-domain.com/usermgmt/login`
2. 输入 `USER_ADMIN` 环境变量的密码
3. 点击"登录"按钮

### 查看用户列表

登录后自动跳转到用户列表页面，显示：
- **总用户数**
- **启用用户数**
- **已过期用户数**
- 用户详细信息（UUID、状态、过期时间、备注）

### 添加用户

1. 点击页面右上角"+ 添加用户"按钮
2. 填写用户信息：
   - **UUID**：标准 UUID 格式（如 `a1b2c3d4-1234-4567-89ab-123456789abc`）
   - **启用用户**：勾选表示启用，不勾选表示禁用
   - **过期时间**：毫秒时间戳，留空表示永久有效
   - **备注**：用户描述（如"张三 - VIP用户"）
3. 点击"保存"按钮

**快速设置过期时间**：
- 点击"30天后"自动设置为 30 天后过期
- 点击"1年后"自动设置为 1 年后过期
- 点击"永久"清空过期时间（永久有效）

**UUID 生成工具**：
```bash
# Linux/macOS
uuidgen | tr '[:upper:]' '[:lower:]'

# Python
python3 -c "import uuid; print(uuid.uuid4())"

# Node.js
node -e "console.log(require('crypto').randomUUID())"

# PowerShell
[guid]::NewGuid().ToString()
```

### 编辑用户

1. 在用户列表中找到要编辑的用户
2. 点击"✏️ 编辑"按钮
3. 修改用户信息
4. 点击"保存"按钮

**注意**：编辑时 UUID 无法修改。

### 删除用户

1. 在用户列表中找到要删除的用户
2. 点击"🗑️ 删除"按钮
3. 确认删除操作

**警告**：删除操作不可恢复！

### 查看用户订阅记录

1. 在用户列表中找到要查看的用户
2. 点击"📊 日志"按钮
3. 查看该用户的所有订阅访问记录

**记录内容**：
- 访问时间
- IP 地址
- 国家
- User-Agent（客户端类型）

### 登出

点击页面右上角"退出登录"按钮。

---

## 🛡️ 用户验证流程

### 验证触发点

系统会在两个关键点验证用户 UUID：

1. **订阅生成时**（`/sub?token=xxx`）
   - 验证 UUID 是否在白名单中
   - 检查用户是否被禁用
   - 检查用户是否过期
   - 记录订阅访问日志

2. **WebSocket 连接时**
   - 使用缓存优先策略（5分钟缓存）
   - 验证失败返回 403 错误
   - 验证通过建立连接

### 验证逻辑

```
用户请求 (UUID)
    ↓
检查内存缓存（5分钟）
    ├─ 缓存命中 → 返回验证结果（<1ms）
    └─ 缓存未命中 → 查询 D1
        ├─ D1 未配置 → 放行所有用户（向后兼容）
        ├─ 用户不存在 → 拒绝（403）
        ├─ 用户被禁用 → 拒绝（403）
        ├─ 用户已过期 → 拒绝（403）
        └─ 验证通过 → 允许访问
```

### 错误提示

用户被拒绝时会看到：

```
订阅访问被拒绝
原因: UUID不在白名单中

请联系管理员
```

或

```
WebSocket 连接被拒绝: 用户已过期
```

---

## 📊 性能说明

### 缓存机制

- **缓存时间**：5 分钟
- **缓存内容**：UUID 验证结果（有效/无效 + 原因）
- **缓存命中率**：预计 95%+
- **性能提升**：缓存命中时验证速度 <1ms

### 对连接性能的影响

- **WebSocket 数据转发**：完全不受影响（零修改）
- **首次连接**：增加 <20ms（D1 查询时间）
- **后续连接**：<1ms（缓存命中）
- **D1 故障**：自动放行，不影响服务

### 数据清理

- **订阅记录**：自动保留 30 天（1% 概率触发清理）
- **缓存清理**：每 100 次请求清理一次过期缓存

---

## 🔍 监控和调试

### 查看实时日志

```bash
wrangler tail
```

**正常日志示例**：
```
[UUID缓存] 命中: a1b2c3d4-... - 有效
[订阅记录] UUID: a1b2c3d4-...
[UUID验证] 验证通过: a1b2c3d4-... - 张三 - VIP用户
```

**错误日志示例**：
```
[UUID验证] 用户不存在: bad-uuid-...
[UUID验证] 用户已禁用: disabled-user-...
[UUID验证] 用户已过期: expired-user-... (2024-01-01 00:00:00)
```

### 数据库统计

```bash
# 用户总数
wrangler d1 execute edgetunnel_db --command="SELECT COUNT(*) as total FROM users;"

# 启用用户数
wrangler d1 execute edgetunnel_db --command="SELECT COUNT(*) as enabled FROM users WHERE enabled = 1;"

# 订阅记录总数
wrangler d1 execute edgetunnel_db --command="SELECT COUNT(*) as total FROM subscription_logs;"

# 今天的订阅次数
wrangler d1 execute edgetunnel_db --command="
SELECT COUNT(*) as today_count
FROM subscription_logs
WHERE timestamp >= strftime('%s', 'now', 'start of day') * 1000;
"
```

---

## ⚠️ 常见问题

### 1. 访问 /usermgmt 显示"未配置用户管理密码"

**原因**：未设置 `USER_ADMIN` 环境变量

**解决方案**：
```bash
# 设置 USER_ADMIN 环境变量
wrangler secret put USER_ADMIN
# 输入你的密码

# 重新部署
wrangler deploy
```

### 2. 登录时提示"密码错误"

**原因**：输入的密码与 `USER_ADMIN` 环境变量不匹配

**解决方案**：
```bash
# 检查环境变量
wrangler secret list

# 重新设置密码
wrangler secret put USER_ADMIN
```

### 3. 添加用户时提示"D1 数据库未配置"

**原因**：未创建 D1 数据库或 `wrangler.toml` 配置错误

**解决方案**：
1. 检查 `wrangler.toml` 中的 `database_id` 是否正确
2. 执行 `wrangler d1 list` 查看数据库列表
3. 执行 `wrangler deploy` 重新部署

### 4. 用户无法连接，提示 "UUID不在白名单中"

**原因**：用户 UUID 未添加到 D1 数据库

**解决方案**：
1. 访问 `/usermgmt` 管理面板
2. 点击"+ 添加用户"
3. 填写用户 UUID 并保存

### 5. D1 数据库查询失败

**现象**：日志显示 `[UUID验证] D1 查询失败: xxx - 放行`

**说明**：这是正常的降级行为，系统会自动放行所有用户，避免服务中断

**解决方案**：
1. 检查 D1 数据库状态
2. 检查 `wrangler.toml` 配置
3. 重新部署 Workers

---

## 🔧 使用命令行直接管理 D1 数据库

如果无法访问 Web 管理面板，也可以直接操作 D1 数据库：

### 查看所有用户

```bash
wrangler d1 execute edgetunnel_db --command="SELECT uuid, enabled, expires_at, remark FROM users;"
```

### 添加用户

```bash
wrangler d1 execute edgetunnel_db --command="
INSERT INTO users (uuid, enabled, expires_at, created_at, updated_at, remark)
VALUES (
  'a1b2c3d4-1234-4567-89ab-123456789abc',
  1,
  1735689600000,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000,
  '张三 - VIP用户'
);
"
```

### 禁用用户

```bash
wrangler d1 execute edgetunnel_db --command="
UPDATE users SET enabled = 0 WHERE uuid = 'user-uuid-here';
"
```

### 延长用户有效期

```bash
wrangler d1 execute edgetunnel_db --command="
UPDATE users SET expires_at = 1767225600000 WHERE uuid = 'user-uuid-here';
"
```

### 删除用户

```bash
wrangler d1 execute edgetunnel_db --command="
DELETE FROM users WHERE uuid = 'user-uuid-here';
"
```

### 查看订阅记录

```bash
wrangler d1 execute edgetunnel_db --command="
SELECT uuid, ip_address, country, user_agent,
       datetime(timestamp/1000, 'unixepoch') as access_time
FROM subscription_logs
ORDER BY timestamp DESC
LIMIT 20;
"
```

---

## 📚 对接其他项目

如果你想开发一个独立的用户管理工具，可以直接绑定 D1 数据库。

### 方式：直接绑定 D1 数据库

适合 Cloudflare Workers/Pages 项目。

**wrangler.toml**：
```toml
[[d1_databases]]
binding = "EDGETUNNEL_DB"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # 与 edgetunnel 相同
```

**代码示例**：
```javascript
export default {
  async fetch(request, env, ctx) {
    // 查询所有用户
    const users = await env.EDGETUNNEL_DB
      .prepare('SELECT * FROM users')
      .all();

    // 添加用户
    const now = Date.now();
    await env.EDGETUNNEL_DB
      .prepare('INSERT INTO users (uuid, enabled, expires_at, created_at, updated_at, remark) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(uuid, 1, expiresAt, now, now, remark)
      .run();

    // 查询订阅记录
    const logs = await env.EDGETUNNEL_DB
      .prepare('SELECT * FROM subscription_logs WHERE uuid = ? ORDER BY timestamp DESC LIMIT 100')
      .bind(uuid)
      .all();

    return new Response(JSON.stringify(users.results));
  }
};
```

---

## 🔒 安全建议

1. **强密码**：`USER_ADMIN` 必须使用强密码（建议 20+ 字符，包含大小写字母、数字、特殊符号）
2. **HTTPS 访问**：始终通过 HTTPS 访问管理面板
3. **定期审计**：定期查看订阅记录，检查异常访问
4. **备份数据**：定期导出用户数据备份

```bash
# 导出用户数据
wrangler d1 execute edgetunnel_db --command="SELECT * FROM users;" > users_backup.txt
```

---

## 📝 总结

EdgeTunnel D1 用户管理系统提供了完整的 Web 管理界面：

✅ **功能完整**：创建、查询、更新、删除用户，查看访问记录
✅ **性能优异**：5分钟缓存，验证速度 <1ms
✅ **独立管理**：使用独立密码（USER_ADMIN），与原管理面板分离
✅ **安全可靠**：自动降级，D1 故障不影响服务
✅ **易于使用**：美观的 Web 界面，无需命令行操作

**支持与反馈**：
如有问题或建议，请在 GitHub 提交 Issue。

---

**最后更新**：2026-01-25
**版本**：v2.0.0 (Web Panel)
