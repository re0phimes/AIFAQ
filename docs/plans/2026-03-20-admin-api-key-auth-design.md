# Admin API Key Unified Auth Design

Date: 2026-03-20

## Context

当前项目的 admin API 鉴权仍然不统一：

- [lib/auth.ts](C:\Users\re0ph\Code\AIFAQ\lib\auth.ts) 中的 `verifyAdmin()` 只检查 GitHub admin session。
- [app/api/admin/faq/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\faq\route.ts)、
  [app/api/admin/faq/[id]/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\faq\[id]\route.ts)、
  [app/api/admin/faq/import/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\faq\import\route.ts)、
  [app/api/admin/faq/import/[id]/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\faq\import\[id]\route.ts)
  仍然只依赖 session。
- [app/api/admin/users/[id]/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\users\[id]\route.ts) 甚至没有复用 `verifyAdmin()`。
- 提交页文案已经说明支持 `Authorization: Bearer YOUR_API_KEY`，但实现尚未真正落地。

这会直接阻塞后续几类场景：

- `self-hosted runner` 调用 admin API
- `curl` / 脚本的程序化上传
- 后续批量 API 与自动化审核链路

因此，第 1 项需要先把 admin 认证统一到“浏览器 session + Bearer API key”双通道模型。

## Confirmed Decisions

1. 统一入口放在 `lib/auth.ts`，不在每个路由各写一套 Bearer 解析逻辑。
2. `verifyAdmin` 改为接收 `NextRequest`，统一处理 bearer + session。
3. `Authorization` header 存在时，优先按 Bearer 规则处理。
4. 如果请求显式携带错误的 `Authorization` header`，直接返回未授权，不回退到 session。
5. Bearer key 只允许从请求头传递，不支持 query 参数。
6. Bearer key 比较使用固定时间比较，避免明文比较带来的侧信道风险。
7. 首批接入范围仅覆盖以下 5 个 admin 路由：
   - [app/api/admin/faq/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\faq\route.ts)
   - [app/api/admin/faq/[id]/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\faq\[id]\route.ts)
   - [app/api/admin/faq/import/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\faq\import\route.ts)
   - [app/api/admin/faq/import/[id]/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\faq\import\[id]\route.ts)
   - [app/api/admin/users/[id]/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\users\[id]\route.ts)
8. 这次不把 [app/api/seed/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\seed\route.ts) 纳入范围。

## Options Considered

### Option A: Centralize in `verifyAdmin(request)` and reuse everywhere

做法：
- 在 `lib/auth.ts` 中统一解析 `Authorization`
- 统一 Bearer 与 session 回退逻辑
- 所有目标 admin 路由只调用一个函数

优点：
- 逻辑集中
- 后续 runner / batch / callback 路由复用简单
- 最不容易出现单路由行为漂移

缺点：
- 需要调整现有所有目标路由调用签名

### Option B: Each route handles Bearer and session independently

优点：
- 局部修改，看起来直接

缺点：
- 重复代码多
- 高风险出现“有的路由支持 Bearer，有的路由不支持”的漂移
- 很难稳定落实“错误 Authorization 不回退 session”

### Option C: Push Bearer auth into middleware

优点：
- 路由表面代码更少

缺点：
- API 级错误处理规则不够清晰
- 对“有 header 就不回退”的语义控制较差
- 后续内部路由和非页面场景扩展不如函数式校验灵活

## Decision

选择 Option A。

原因：
- 它最符合当前任务“统一鉴权”的目标，而不是“补丁式给几个路由加 if 判断”。
- 现有代码已经有 `verifyAdmin()` 入口，扩展成本最低。
- 后续第 2 项 Agent 触发与执行隔离会直接复用这套能力。

## Auth Contract

### Function Shape

在 [lib/auth.ts](C:\Users\re0ph\Code\AIFAQ\lib\auth.ts) 提供统一入口：

```ts
export async function verifyAdmin(request?: NextRequest): Promise<boolean>
```

### Resolution Rules

1. 如果没有传 `request`，保留现有 session-only 行为。
2. 如果传了 `request` 且没有 `Authorization` header：
   - 使用现有 GitHub admin session 判断。
3. 如果传了 `request` 且存在 `Authorization` header：
   - 只接受 `Bearer <token>` 形式。
   - 非 Bearer 形式直接拒绝。
   - Bearer token 缺失或不匹配直接拒绝。
   - 不再回退到 session。
4. key 来源仅允许：
   - `Authorization: Bearer <ADMIN_API_KEY>`
5. 明确不支持：
   - query string
   - request body
   - cookie 中的 API key

## Security Rules

1. Bearer 比较使用固定时间比较。
2. 当 `ADMIN_API_KEY` 未配置时：
   - Bearer 校验路径直接失败
   - 不抛出泄露配置状态的细节
3. 不记录明文 API key。
4. 不在错误响应中暴露“key 错误”还是“session 错误”的区别，只返回统一 `401`。

## Route Changes

以下路由要统一切换为 `verifyAdmin(request)`：

1. [app/api/admin/faq/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\faq\route.ts)
- `GET`
- `POST`

2. [app/api/admin/faq/[id]/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\faq\[id]\route.ts)
- `PATCH`

3. [app/api/admin/faq/import/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\faq\import\route.ts)
- `POST`

4. [app/api/admin/faq/import/[id]/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\faq\import\[id]\route.ts)
- `GET`

5. [app/api/admin/users/[id]/route.ts](C:\Users\re0ph\Code\AIFAQ\app\api\admin\users\[id]\route.ts)
- `PATCH`
- 从“本地直接读 session”切换到统一鉴权入口

## Environment Contract

更新 [.env.example](C:\Users\re0ph\Code\AIFAQ\.env.example)：

```env
ADMIN_API_KEY=
```

要求：
- 与 [app/admin/submit/page.tsx](C:\Users\re0ph\Code\AIFAQ\app\admin\submit\page.tsx) 的 API 文案一致
- 不在仓库中提供默认值

## Testing Strategy

这次不做大而全集成测试，先锁定最关键的 contract：

1. session admin 可访问
2. 正确 Bearer 可访问
3. 错误 Bearer 不回退 session
4. 非 Bearer `Authorization` 形式被拒绝

建议新增一个轻量 contract test，直接针对源码结构和关键逻辑约束。

## Out of Scope

- 扩展到 `app/api/seed/route.ts`
- 增加更复杂的 key 轮换机制
- 增加多个 API key 或 key scope
- 改造 middleware
- 引入外部 secret manager

## Success Criteria

- 5 个目标 admin 路由全部支持：
  - GitHub admin session
  - `Authorization: Bearer <ADMIN_API_KEY>`
- 错误 `Authorization` header 不会回退到 session。
- `.env.example` 明确包含 `ADMIN_API_KEY=`
- 提交页 Bearer 文案与真实实现不再脱节
- 为后续 runner / 批量 API / 自动化链路提供稳定认证底座
