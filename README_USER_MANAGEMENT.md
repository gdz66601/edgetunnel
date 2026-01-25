# EdgeTunnel D1 用户管理系统使用说明

## 📖 概述

本系统为 EdgeTunnel 添加了基于 Cloudflare D1 的用户管理功能，实现 UUID 白名单控制、用户过期时间管理和访问记录。

**核心特性**：
- ✅ UUID 白名单控制（只有授权用户才能连接）
- ✅ 用户过期时间自动检查
- ✅ 订阅访问记录
- ✅ 5 分钟内存缓存，性能优化
- ✅ 独立的管理 API，与原管理面板分离
- ✅ 完全向后兼容（D1 未配置时正常运行）

---

## 🚀 快速开始

### 1. 创建 D1 数据库

```bash
cd c:\Users\ZhangFan\Documents\GitHub\edgetunnel
wrangler d1 create edgetunnel_db
```

**输出示例**：
```
✅ Successfully created DB 'edgetunnel_db' in region APAC
Created your database using D1's new storage backend.

[[d1_databases]]
binding = "DB"
database_name = "edgetunnel_db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. 更新 wrangler.toml

复制上面输出的 `database_id`，填入 `wrangler.toml`：

```toml
# D1 数据库绑定（用户管理系统）
[[d1_databases]]
binding = "DB"
database_name = "edgetunnel_db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # 填入你的 database_id
```

### 3. 执行数据库迁移

```bash
# 本地测试环境
wrangler d1 execute edgetunnel_db --local --file=./migrations/0001_initial_schema.sql

# 生产环境（必须执行）
wrangler d1 execute edgetunnel_db --remote --file=./migrations/0001_initial_schema.sql
```

### 4. 配置环境变量

在 Cloudflare Workers 控制台 > 设置 > 变量和机密 中添加：

| 变量名 | 必填 | 说明 | 示例 |
|--------|:----:|------|------|
| `API_SECRET` | ✅ | 用户管理 API 密码（独立密码） | `your-strong-api-password-123` |
| `ADMIN` | ⚠️ | 原管理面板密码（已存在） | `admin-password` |
| `DB` | 自动 | D1 数据库绑定（wrangler.toml 配置） | - |

**重要说明**：
- `API_SECRET`：用于访问用户管理 API（`/api/users`），与原管理面板密码**完全独立**
- `ADMIN`：用于访问原管理面板（`/admin`），保持不变
- 两个密码互不影响，分别控制不同功能

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

### 用户管理 API（/api/users）

**访问路径**：`https://your-domain.com/api/users`
**认证方式**：HTTP Bearer Token（Header 头）
**密码环境变量**：`API_SECRET`（独立密码）
**功能**：
- 查看所有用户
- 创建/更新用户
- 删除用户
- 查看用户订阅记录

**说明**：专门用于用户管理，使用独立密码，与原管理面板分离。

---

## 📡 用户管理 API 详解

### 认证方式

所有 API 请求必须在 HTTP Header 中携带 `Authorization` 头：

```bash
Authorization: Bearer <你的API密码>
```

**重要**：这里的密码直接使用 `API_SECRET` 环境变量的值，**不需要 MD5 加密**。

### API 端点列表

#### 1. 获取所有用户

```http
GET /api/users
```

**请求示例**：
```bash
curl "https://your-domain.com/api/users" \
  -H "Authorization: Bearer your-api-secret"
```

**响应示例**：
```json
[
  {
    "uuid": "a1b2c3d4-1234-4567-89ab-123456789abc",
    "enabled": 1,
    "expires_at": 1735689600000,
    "remark": "张三 - VIP用户"
  },
  {
    "uuid": "b2c3d4e5-2345-5678-9abc-23456789abcd",
    "enabled": 0,
    "expires_at": 1704067200000,
    "remark": "李四 - 已禁用"
  }
]
```

#### 2. 获取单个用户信息

```http
GET /api/users/{uuid}
```

**请求示例**：
```bash
curl "https://your-domain.com/api/users/a1b2c3d4-1234-4567-89ab-123456789abc" \
  -H "Authorization: Bearer your-api-secret"
```

**响应示例**：
```json
{
  "uuid": "a1b2c3d4-1234-4567-89ab-123456789abc",
  "enabled": 1,
  "expires_at": 1735689600000,
  "created_at": 1704067200000,
  "updated_at": 1704067200000,
  "remark": "张三 - VIP用户"
}
```

#### 3. 创建/更新用户

```http
POST /api/users
Content-Type: application/json
```

**请求体**：
```json
{
  "uuid": "a1b2c3d4-1234-4567-89ab-123456789abc",
  "enabled": 1,
  "expires_at": 1735689600000,
  "remark": "张三 - VIP用户"
}
```

**字段说明**：
- `uuid`（必填）：用户 UUID，必须是标准 UUID 格式
- `enabled`（可选）：是否启用，`1` = 启用，`0` = 禁用，默认 `1`
- `expires_at`（可选）：过期时间戳（毫秒），`null` = 永不过期
- `remark`（可选）：备注信息，如用户名、描述等

**请求示例**：
```bash
curl "https://your-domain.com/api/users" \
  -X POST \
  -H "Authorization: Bearer your-api-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "a1b2c3d4-1234-4567-89ab-123456789abc",
    "enabled": 1,
    "expires_at": 1735689600000,
    "remark": "张三 - VIP用户"
  }'
```

**响应示例**：
```json
{
  "success": true
}
```

**时间戳生成工具**：
```bash
# 获取当前时间戳（毫秒）
date +%s000

# 获取指定日期时间戳（毫秒）- Linux/macOS
date -d "2025-12-31 23:59:59" +%s000

# Windows PowerShell
[DateTimeOffset]::Parse("2025-12-31 23:59:59").ToUnixTimeMilliseconds()
```

#### 4. 删除用户

```http
DELETE /api/users/{uuid}
```

**请求示例**：
```bash
curl "https://your-domain.com/api/users/a1b2c3d4-1234-4567-89ab-123456789abc" \
  -X DELETE \
  -H "Authorization: Bearer your-api-secret"
```

**响应示例**：
```json
{
  "success": true
}
```

#### 5. 获取用户订阅记录

```http
GET /api/users/{uuid}/logs?limit=100&offset=0
```

**查询参数**：
- `limit`（可选）：返回记录数量，默认 `100`
- `offset`（可选）：跳过记录数量，默认 `0`

**请求示例**：
```bash
curl "https://your-domain.com/api/users/a1b2c3d4-1234-4567-89ab-123456789abc/logs?limit=50" \
  -H "Authorization: Bearer your-api-secret"
```

**响应示例**：
```json
[
  {
    "id": 123,
    "uuid": "a1b2c3d4-1234-4567-89ab-123456789abc",
    "ip_address": "1.2.3.4",
    "country": "CN",
    "user_agent": "Clash/1.18.0",
    "timestamp": 1704067200000
  }
]
```

---

## 💡 常见使用场景

### 场景 1：添加新用户（永久有效）

```bash
curl "https://your-domain.com/api/users" \
  -X POST \
  -H "Authorization: Bearer your-api-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "new-user-uuid-here",
    "enabled": 1,
    "expires_at": null,
    "remark": "新用户 - 永久有效"
  }'
```

### 场景 2：添加临时用户（30天有效）

```bash
# 计算30天后的时间戳
EXPIRE_TIME=$(($(date +%s) * 1000 + 30 * 24 * 60 * 60 * 1000))

curl "https://your-domain.com/api/users" \
  -X POST \
  -H "Authorization: Bearer your-api-secret" \
  -H "Content-Type: application/json" \
  -d "{
    \"uuid\": \"temp-user-uuid\",
    \"enabled\": 1,
    \"expires_at\": $EXPIRE_TIME,
    \"remark\": \"临时用户 - 30天\"
  }"
```

### 场景 3：禁用用户（不删除，可重新启用）

```bash
curl "https://your-domain.com/api/users" \
  -X POST \
  -H "Authorization: Bearer your-api-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "user-to-disable",
    "enabled": 0,
    "remark": "用户违规 - 已禁用"
  }'
```

### 场景 4：延长用户有效期

```bash
# 延长到 2025-12-31
curl "https://your-domain.com/api/users" \
  -X POST \
  -H "Authorization: Bearer your-api-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "existing-user-uuid",
    "expires_at": 1735689600000,
    "remark": "VIP用户 - 续费至2025-12-31"
  }'
```

### 场景 5：查看用户最近访问记录

```bash
curl "https://your-domain.com/api/users/user-uuid/logs?limit=10" \
  -H "Authorization: Bearer your-api-secret"
```

---

## 🔧 使用命令行直接管理 D1 数据库

如果不想使用 API，也可以直接操作 D1 数据库：

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
  $(date +%s)000,
  $(date +%s)000,
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

### 删除用户

```bash
wrangler d1 execute edgetunnel_db --command="
DELETE FROM users WHERE uuid = 'user-uuid-here';
"
```

### 查看订阅记录

```bash
wrangler d1 execute edgetunnel_db --command="
SELECT uuid, ip_address, country, user_agent, datetime(timestamp/1000, 'unixepoch') as access_time
FROM subscription_logs
ORDER BY timestamp DESC
LIMIT 20;
"
```

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
WHERE timestamp >= $(date -d 'today 00:00:00' +%s)000;
"
```

---

## ⚠️ 常见问题

### 1. API 返回 401 Unauthorized

**原因**：密码错误或未设置 `API_SECRET` 环境变量

**解决方案**：
```bash
# 检查环境变量
wrangler secret list

# 设置 API_SECRET
wrangler secret put API_SECRET
# 输入你的密码
```

### 2. API 返回 500 D1 not configured

**原因**：未创建 D1 数据库或 `wrangler.toml` 配置错误

**解决方案**：
1. 检查 `wrangler.toml` 中的 `database_id` 是否正确
2. 执行 `wrangler deploy` 重新部署

### 3. 用户无法连接，提示 "UUID不在白名单中"

**原因**：用户 UUID 未添加到 D1 数据库

**解决方案**：
```bash
# 方式1：使用 API 添加
curl "https://your-domain.com/api/users" \
  -X POST \
  -H "Authorization: Bearer your-api-secret" \
  -H "Content-Type: application/json" \
  -d '{"uuid":"user-uuid","enabled":1,"remark":"新用户"}'

# 方式2：直接操作 D1
wrangler d1 execute edgetunnel_db --command="
INSERT INTO users (uuid, enabled, created_at, updated_at, remark)
VALUES ('user-uuid', 1, $(date +%s)000, $(date +%s)000, '新用户');
"
```

### 4. D1 数据库查询失败

**现象**：日志显示 `[UUID验证] D1 查询失败: xxx - 放行`

**说明**：这是正常的降级行为，系统会自动放行所有用户，避免服务中断

**解决方案**：
1. 检查 D1 数据库状态
2. 检查 `wrangler.toml` 配置
3. 重新部署 Workers

---

## 📚 对接其他项目

如果你想开发一个独立的用户管理面板，可以通过 HTTP API 或直接绑定 D1 数据库。

### 方式一：HTTP API（推荐）

适合任何语言/框架开发的管理面板。

**JavaScript/TypeScript 示例**：
```javascript
const API_BASE = 'https://your-domain.com';
const API_SECRET = 'your-api-secret';

async function getAllUsers() {
  const response = await fetch(`${API_BASE}/api/users`, {
    headers: { 'Authorization': `Bearer ${API_SECRET}` }
  });
  return await response.json();
}

async function createUser(uuid, remark, expiresAt) {
  const response = await fetch(`${API_BASE}/api/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      uuid,
      enabled: 1,
      expires_at: expiresAt,
      remark
    })
  });
  return await response.json();
}
```

**Python 示例**：
```python
import requests

API_BASE = 'https://your-domain.com'
API_SECRET = 'your-api-secret'

def get_all_users():
    response = requests.get(
        f'{API_BASE}/api/users',
        headers={'Authorization': f'Bearer {API_SECRET}'}
    )
    return response.json()

def create_user(uuid, remark, expires_at=None):
    response = requests.post(
        f'{API_BASE}/api/users',
        headers={
            'Authorization': f'Bearer {API_SECRET}',
            'Content-Type': 'application/json'
        },
        json={
            'uuid': uuid,
            'enabled': 1,
            'expires_at': expires_at,
            'remark': remark
        }
    )
    return response.json()
```

### 方式二：直接绑定 D1 数据库

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
    await env.EDGETUNNEL_DB
      .prepare('INSERT INTO users (uuid, enabled, expires_at, created_at, updated_at, remark) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(uuid, 1, expiresAt, now, now, remark)
      .run();

    return new Response(JSON.stringify(users.results));
  }
};
```

---

## 🔒 安全建议

1. **强密码**：`API_SECRET` 必须使用强密码（建议 20+ 字符，包含大小写字母、数字、特殊符号）
2. **HTTPS 访问**：始终通过 HTTPS 访问 API
3. **定期审计**：定期查看订阅记录，检查异常访问
4. **备份数据**：定期导出用户数据备份

```bash
# 导出用户数据
wrangler d1 execute edgetunnel_db --command="SELECT * FROM users;" > users_backup.txt
```

---

## 📝 总结

EdgeTunnel D1 用户管理系统提供了完整的用户白名单控制能力：

✅ **功能完整**：创建、查询、更新、删除用户，查看访问记录
✅ **性能优异**：5分钟缓存，验证速度 <1ms
✅ **独立管理**：使用独立密码（API_SECRET），与原管理面板分离
✅ **安全可靠**：自动降级，D1 故障不影响服务
✅ **易于对接**：标准 REST API，支持任何语言/框架

**支持与反馈**：
如有问题或建议，请在 GitHub 提交 Issue。

---

**最后更新**：2026-01-25
**版本**：v1.0.0
