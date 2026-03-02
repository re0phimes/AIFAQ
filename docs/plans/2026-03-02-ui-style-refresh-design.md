# UI 风格刷新设计文档

**日期**: 2026-03-02
**主题**: 去除 emoji，优化灰色背景，统一视觉风格

---

## 背景

当前 UI 存在以下视觉问题：
1. `--color-surface: #F5F5F5` 偏灰黄，显得陈旧
2. 多处使用 emoji（👤🚪⚠️📚📖✅📄📌），风格不统一
3. Profile 页面与主页风格略有差异

参考 alphaxiv.org 的极简学术风格，决定优化现有设计。

---

## 设计决策

### 颜色方案（方案 C：保留暗红主色）

| Token | 当前值 | 新值 | 说明 |
|-------|--------|------|------|
| `--color-surface` | `#F5F5F5` | `#FAFAFA` | 更浅的灰，接近纯白 |
| `--color-border` | `#E5E5E5` | `#EAEAEA` | 更柔和的边框色 |
| `--color-primary` | `#9a2036` | `#9a2036` | 保留暗红主色 |
| `--color-bg` | `#FFFFFF` | `#FFFFFF` | 保持纯白背景 |
| `--color-text` | `#171717` | `#171717` | 保持深色文字 |

**效果**：surface 从偏黄的灰变为干净的冷灰，整体更现代。

---

### Emoji 替换方案

| 位置 | 文件 | 当前 | 替换为 |
|------|------|------|--------|
| 用户菜单-我的学习 | `FAQList.tsx` | 👤 | 纯文字，去掉图标 |
| 用户菜单-退出 | `FAQList.tsx` | 🚪 | 纯文字，去掉图标 |
| Profile 警告 | `ProfileClient.tsx` | ⚠️ | AlertTriangle SVG（amber） |
| Profile 状态 | `ProfileClient.tsx` | 📚 | 灰色圆点 |
| Profile 状态 | `ProfileClient.tsx` | 📖 | 蓝色圆点 |
| Profile 状态 | `ProfileClient.tsx` | ✅ | 绿色圆点 |
| 引用类型 | `ReferenceList.tsx` | 📄📖📌 | 简化为文字标签 |

---

### Profile 状态标签样式

```
未看    ● 未看      (灰色圆点 bg-gray-400)
学习中  ● 学习中    (蓝色圆点 bg-blue-500)
已内化  ● 已内化    (绿色圆点 bg-green-500)
```

圆点尺寸：6px，与文字垂直居中。

---

## 修改文件清单

1. `app/globals.css` - 更新 CSS 变量
2. `components/FAQList.tsx` - 移除用户菜单 emoji
3. `app/profile/ProfileClient.tsx` - 移除 emoji，添加圆点状态指示器
4. `components/ReferenceList.tsx` - 移除 emoji，简化引用类型显示

---

## 预期效果

- 整体色调更干净、现代
- 去除 emoji 的随意感，更专业
- Profile 页面与主页风格统一
- 状态指示更清晰（颜色编码）
