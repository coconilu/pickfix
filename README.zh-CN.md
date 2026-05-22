# PickFix

> Point, pick, fix — 面向实时预览的 AI 开发工具。

PickFix 让你可以在实时预览里点击一个元素，描述想要的 UI 修改，然后让 AI coding agent 去编辑真实源码。你可以查看 diff、继续迭代，或者在 Changes 面板里回滚单个文件。

![PickFix 工作区](./docs/images/workspace.png)

## 快速开始

安装依赖：

```bash
pnpm install
```

使用内置 Next.js demo 启动 PickFix：

```bash
pnpm dev
```

打开：

```txt
http://localhost:3001
```

这个命令会按顺序启动三个本地服务：

1. 目标应用：`5678`
2. PickFix proxy：`4000`
3. PickFix web UI：`3001`

## 试一下基础流程

1. 打开 `http://localhost:3001`。
2. 在 Live Preview 工具栏点击 **Pick Element**。
3. 点击预览里的文字、按钮或任意可见 UI 元素。
4. 输入一个小的修改请求，例如：

   ```txt
   把这个标题改得更友好一点，并稍微放大。
   ```

5. 观察预览热更新。
6. 在 Changes 面板查看被修改的文件和 diff。
7. 如果结果不对，可以回滚单个文件。

## 用在你自己的项目里

在 PickFix 仓库目录下，把 PickFix 指向任意本地应用：

```bash
pnpm pickfix -- \
  --project /absolute/path/to/your-app \
  --dev 'pnpm dev --port 5678' \
  --port 5678
```

`--dev` 里的命令需要把你的应用启动到和 `--port` 相同的端口。

Next.js 示例：

```bash
pnpm pickfix -- \
  --project /Users/me/projects/my-next-app \
  --dev 'pnpm exec next dev -p 5678' \
  --port 5678
```

Nuxt 示例：

```bash
pnpm pickfix -- \
  --project /Users/me/projects/my-nuxt-app \
  --dev 'pnpm dev --port 5678' \
  --port 5678
```

如果你的 dev server 已经在运行：

```bash
pnpm pickfix -- \
  --project /absolute/path/to/your-app \
  --target http://localhost:5173 \
  --no-dev
```

## 目前能做什么

- 以外部项目的方式运行目标应用，不需要往目标项目里安装 PickFix。
- 通过 proxy 代理目标应用，并注入轻量的元素选择 bridge。
- 把选中元素的元信息发送给 agent：tag、class、selector、文本、位置尺寸、HTML hint。
- 让本地 Claude Code agent 根据选中上下文修改源码。
- 展示目标项目里的文件变更和 diff。
- 支持从 Changes 面板回滚单个文件。
- 按目标项目保存聊天历史，刷新页面后仍可恢复。

PickFix 目前还是 MVP，更适合本地实验和小范围 UI 修改。

## 截图

### 选中页面元素

![选中元素](./docs/images/pick-element.png)

Pick mode 会在被代理的实时预览中高亮你指向的具体元素。

### 查看和回滚变更

![查看变更](./docs/images/changes-panel.png)

Changes 面板会展示 diff，并在丢弃某个文件的本地修改前要求确认。

## 为什么做 PickFix

UI 修改经常从一个视觉目标开始：“这个按钮”、“那个标题”、“这张卡片”。PickFix 把实时预览变成上下文选择器，让 agent 在修改代码前先拿到足够的元素信息。

它不是为了替代编辑器或 Git 工作流。它想优化的是 UI 修改的第一步：指一下，说需求，看代码结果。

## 工作原理

```txt
browser → PickFix web UI (:3001)
            ├── Agent Chat
            ├── Preview iframe → PickFix proxy (:4000) → target app (:5678)
            └── Changes panel → target project 的 git status/diff

proxy → 拦截 HTML → 注入 /__pf/bridge.js
bridge → 在 iframe 内运行 → 通过 postMessage 发送选中元素元信息
agent → 在目标项目目录中运行 → 修改真实源码文件
```

目标项目不需要安装 PickFix 依赖。PickFix 会启动你的 dev server，代理页面，在运行时注入浏览器 bridge，并让 agent 以目标项目为工作目录执行修改。

## 环境要求

- Node `~24`
- pnpm `10.33.2`
- 本机可用 Git
- 本机安装 Claude Code CLI，并可通过 `claude` 命令调用

检查 Claude Code：

```bash
claude --version
```

如果你的 Claude Code 命令不是 `claude`，可以设置：

```bash
export CLAUDE_BIN=/path/to/claude
```

可选：指定模型。

```bash
export PF_CLAUDE_MODEL=sonnet
```

## 常用命令

```bash
# 使用内置 Next.js demo 启动
pnpm dev

# 使用内置 Nuxt demo 启动
pnpm dev:nuxt

# 类型检查所有包
pnpm typecheck

# 运行测试
pnpm test

# 完整检查
pnpm check
```

## Monorepo 结构

```txt
pickfix/
├── apps/
│   └── web/          # Next.js UI：chat、preview、changes panel
├── packages/
│   ├── bridge/       # 注入到 iframe 的元素选择 bridge
│   ├── cli/          # 按顺序启动 target → proxy → web
│   └── proxy/        # HTTP/WS proxy 和 bridge 注入
└── examples/
    ├── next-demo/    # 外部 Next.js 示例应用
    └── nuxt-demo/    # 外部 Nuxt 示例应用
```

## 当前限制

- Agent 效果取决于选中元素的元信息和 prompt 清晰度。
- PickFix 目前聚焦本地开发，不是远程部署工具。
- Changes 面板依赖 Git status/diff；目标项目最好位于 Git 仓库中。
- Branch/worktree 管理和源码标注还在规划中。

## 路线图

- [x] 通过 proxy 展示实时预览
- [x] 运行时注入 bridge
- [x] 元素选择
- [x] Agent chat
- [x] Changes 面板和 diff 预览
- [x] 单文件回滚
- [x] 按项目保存聊天历史
- [ ] 源码标注，提升组件/文件定位能力
- [ ] Branch/worktree 工作流
- [ ] Commit/PR 流程
- [ ] 更多框架适配和示例

## License

MIT
