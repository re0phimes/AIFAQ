# User Mobile Adaptive Design

Date: 2026-03-20

## Context

当前用户侧阅读链路已经支持：

- 首页 FAQ 展开阅读
- 收藏页卡片展开阅读
- `DetailModal` 详情弹窗
- Markdown、公式、代码块、图片 gallery/lightbox、标签筛选、分页

但移动端仍有若干横向溢出风险：

- `DetailModal` 宽度和 footer 按钮在窄屏下容易把容器撑宽
- Markdown 中的长链接、代码块、表格、KaTeX 容器容易把父容器撑出视口
- 图片 gallery / lightbox 缩略图和控制按钮在窄屏下可能制造页面级横向滚动
- 分页和筛选按钮在手机端容易因为 `shrink-0` / 固定宽度组合挤出

用户已确认：

1. 本轮只做用户侧
2. 不处理后台审核页
3. 先做简单、低依赖、见效快的方案

## Goal

让用户侧在手机端查看时，不出现页面级横向滚动条；必要时仅允许局部内容容器内部滚动，且优先通过换行和宽度约束消除滚动需求。

## Scope

### In Scope

- 首页 FAQ 列表展开内容
- 收藏页展开内容
- `DetailModal`
- Markdown 内容中的：
  - 长文本 / 长链接
  - 代码块
  - 表格
  - 公式显示块
- 图片 `ImageGallery` / `ImageLightbox`
- `Pagination`
- 用户侧已有的横向筛选容器的安全约束

### Out of Scope

- 后台审核页与后台提交页
- 视觉重构
- 交互逻辑改造
- 新增复杂移动端专用组件

## Approaches Considered

### A. 局部修复 + 宽度约束 + 移动端换行策略

做法：

- 在 `DetailModal`、FAQ 展开区、收藏展开区加入 `min-w-0` / `max-w-full`
- 在 Markdown 容器和全局 CSS 中为长文本、代码块、公式、表格提供移动端友好的宽度策略
- 让分页和局部横向区域只在组件内部滚动，不把页面撑宽

优点：

- 改动小
- 风险低
- 与现有视觉保持一致

缺点：

- 不能一次性解决所有“内容太宽”的表现，只能重点治理高频问题

### B. 全局强制 `overflow-x: hidden`

优点：

- 很快

缺点：

- 容易掩盖真实问题
- 会截断内容
- 可能影响局部横向滚动交互

### C. 独立移动端布局重排

优点：

- 理论上最彻底

缺点：

- 成本高
- 不符合“先做简单的”要求

## Decision

采用方案 A。

核心原则：

1. 优先消除页面级横向溢出
2. 优先用换行与宽度约束处理文本和代码
3. 仅在表格、缩略图带等确有必要的局部区域保留内部横向滚动
4. 不修改后台页面

## Design

### 1. Modal 与内容容器

在 `DetailModal`、FAQ 展开容器、收藏展开容器上补齐：

- `min-w-0`
- `max-w-full`
- 内容区 `overflow-x-hidden`

这样可以避免 flex 子元素因内部长内容导致整个卡片或弹窗被撑宽。

### 2. Markdown 与排版约束

在全局 `.prose` 和对应组件 class 上补齐移动端规则：

- 普通段落、列表、引用支持 `overflow-wrap:anywhere`
- `pre` 保持 `max-width:100%`
- 移动端下 `pre` 改为 `white-space: pre-wrap` + `word-break: break-word`
- inline code 允许断词
- `table-wrapper` 固定为 `max-width:100%`
- KaTeX display 保持在自身容器内滚动，不影响外层布局

### 3. 图片区域

`ImageGallery` 和 `ImageLightbox` 保持局部横向滚动，但限制为组件内部：

- scroller 容器 `max-w-full`
- 外层容器 `min-w-0`
- 缩略图和主图容器不允许把外层 modal 或页面撑宽

### 4. 分页与筛选

`Pagination` 在手机端改成：

- 信息区单独成行
- 页码区允许局部横向滚动
- 页码按钮 `shrink-0`

用户侧已有的收藏页状态筛选带保留局部横向滚动，但保证只在自身容器中滚动，不制造页面级溢出。

## Verification

- 在窄屏下检查首页 FAQ 展开
- 在窄屏下检查收藏页展开
- 打开 `DetailModal` 检查主内容、图片、引用、footer 按钮
- 构造含表格/长代码/公式/长链接内容，确认不会把页面撑出
- 运行 `eslint` / `tsc --noEmit`

## Risks

- 代码块移动端换行会改变一部分原始排版观感，但比横向滚动更符合本轮目标
- 表格极宽时仍可能在局部容器内部滚动，这是可接受保底策略
- 仍需后续用真实移动端设备做手工验证
