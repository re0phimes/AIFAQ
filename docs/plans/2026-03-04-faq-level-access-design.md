# FAQ Level Access Design

**日期**: 2026-03-04  
**主题**: FAQ 分级访问（L1/L2）与后台审核级别管理

---

## 背景

当前 FAQ 系统有用户等级（`free` / `premium`）与管理员角色（`admin`），但 FAQ 内容本身没有访问级别。需求是：

1. 引入 FAQ 级别：`level=1`（默认）与 `level=2`
2. `free`（含未登录与普通登录）只能看到 `level=1`
3. `premium` 与 `admin` 可按 `L1/L2` 过滤查看
4. `admin` 在 `/admin/review` 可查看并调整任意 FAQ 的级别（含已发布条目）
5. 已发布条目调整级别后立即生效

---

## 目标

1. 建立稳定、可审计的 FAQ 级别模型（L1/L2）
2. 在服务端做统一权限过滤，杜绝前端绕过
3. 保持历史 FAQ 无缝兼容（默认归入 L1）
4. 在审核后台提供 level 过滤与单条调整能力

## 非目标

1. 不引入 L3+ 更多级别
2. 不改造现有用户等级体系（仍是 free/premium + admin）
3. 不拆分新表（不做 free/premium 双表）

---

## 方案比较与决策

### 方案 A：`faq_items` 增加 `level` 字段 + 服务端统一过滤（选用）

- 优点：
1. 语义清晰，查询和权限判断最直接
2. 与现有 `tier/role` 权限模型一致
3. 容易支持后台过滤与调整
- 缺点：
1. 需要 schema 迁移和 API/UI 联动

### 方案 B：用 `tags/categories` 约定 premium 内容

- 优点：改动快  
- 缺点：语义脆弱、易误标、查询与维护成本高

### 方案 C：拆分成多表

- 优点：物理隔离强  
- 缺点：复杂度高，超出当前需求规模

### 决策

采用 **方案 A**。  
原因：最稳、最可维护，且与当前代码结构匹配度最高。

---

## 设计规格

## 1. 数据模型

在 `faq_items` 增加字段：

- `level SMALLINT NOT NULL DEFAULT 1 CHECK (level IN (1,2))`

兼容性：

1. 历史数据自动为 `1`
2. 新增 FAQ 默认 `1`

## 2. 权限与查询规则

统一规则（服务端）：

1. `free`（未登录 + 普通登录）：
- 只可见 `level=1`
- 即便传入 `level=2/all` 参数，也强制降级为 `level=1`
2. `premium` / `admin`：
- 可见 `level=1` 与 `level=2`
- 支持过滤参数：`all | 1 | 2`（默认 `all`）

说明：前端隐藏不等于安全，必须以后端过滤为准。

## 3. 前台交互

1. `free` 用户：
- 不显示 `L1/L2` 过滤器
2. `premium` / `admin`：
- 显示 `全部 / L1 / L2` 过滤器
- 默认 `全部`

## 4. Admin Review 交互

`/admin/review` 增加：

1. 列表级过滤：`全部 / L1 / L2`
2. 详情区级别编辑：单条切换 `1/2`
3. 保存后立即刷新列表与详情
4. 对 `published` 条目改级别后立即生效（无需二次审核状态流转）

---

## 异常处理

1. 非 admin 修改 level：返回 `401/403`
2. 非法 level（非 1/2）：返回 `400`
3. 数据库约束兜底拒绝脏数据
4. 公开读取失败时保持安全默认，不泄露 L2

---

## 测试策略

## 1. DB / 迁移

1. 新字段默认值正确（旧数据为 1）
2. `CHECK(level IN (1,2))` 生效

## 2. API / 权限

1. free 只返回 L1
2. premium/admin 支持 `all|1|2`
3. free 传 `level=2` 仍只能拿到 L1
4. admin 可修改任意 FAQ 的 level（含 published）

## 3. 前端

1. free 不显示级别过滤器
2. premium/admin 显示并可切换过滤
3. admin review 支持 level 过滤和单条调整，调整后界面立即反映

---

## 成功标准

1. 后台可对任意 FAQ 设置 `level=1/2`
2. `free` 永远看不到 `level=2`
3. `premium/admin` 可按 L1/L2 过滤
4. 已发布 FAQ 改级别后立即影响可见范围

---

## Worktree 约束

按用户要求，后续实现阶段必须在独立 worktree 进行，不直接在当前主工作区开发。

