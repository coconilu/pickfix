# PickFix

> Point, pick, fix — 面向实时预览的 AI 开发工具。

PickFix 是一个本地开发工具，用来让你通过“点击页面上的元素”来发起 UI 修改。你可以在 PickFix 里打开自己的应用预览，选中一个元素，描述想要的修改，然后让 AI coding agent 去修改真实项目里的源码。修改后你可以查看 diff，继续迭代，或者在 Changes 面板里回滚单个文件。

```txt
┌──────────────┬────────────────────┬──────────────┐
│  Agent Chat  │   Live Preview     │   Changes    │
│              │   (click to pick)  │              │
│  ┌────────┐  │  ┌──────────────┐  │  main        │
│  │ picked │  │  │              │  │  ├── 3 files │
│  │ button │  │  │   iframe     │  │  changed     │
│  │        │  │  │              │  │              │
│  ├────────┤  │  │              │  │  diff view   │
│  │ prompt │  │  └──────────────┘  │  revert      │
│  └────────┘  │                    │              │
└──────────────┴────────────────────┴──────────────┘
```

## 为什么做 PickFix

AI coding 工具已经很擅长写代码，但 UI 修改经常是从一个视觉问题开始的：

- “这个按钮需要更醒目一点。”
- “这个卡片太挤了。”
- “把这个标题文案改一下。”
- “我说的是页面上的这个东西。”

问题在于，agent 通常不知道“这个”到底指的是哪个元素。你需要把视觉目标翻译成文件路径、组件名、CSS 选择器、实现细节。

PickFix 想解决的就是这一步：让实时预览变成上下文选择器。你在页面上点中元素，PickFix 把 DOM 元信息传给 agent，agent 再根据这些线索回到源码里做修改。

## 灵感来源

PickFix 的灵感来自几类工具的组合：

- 浏览器 DevTools：直接检查页面上的具体元素。
- 可视化编辑器：从预览出发修改界面，而不是只盯着文件。
- AI coding agent：让机器完成真实源码里的修改。

PickFix 不想替代编辑器，也不想替代 Git 工作流。它的目标是让 UI 修改的第一步更自然：指一下，说需求，看代码结果。

## 当前能力

- 以外部项目的方式运行目标应用，不需要在目标项目里安装 PickFix。
- 通过 proxy 注入轻量的元素选择 bridge。
- 在预览里点击元素，并把元素元信息传给 agent。
- 通过本地 Claude Code agent 修改目标项目源码。
- 在 Changes 面板里查看目标项目的文件变更和 diff。
- 支持从 Changes 面板回滚单个文件。
- 按项目保存聊天历史，刷新页面后仍可恢复。

PickFix 目前还是 MVP，更适合本地实验和小范围 UI 修改。

## 截图

> 这里先保留截图占位。你在本地跑起来以后，可以替换成真实截图。

### 三栏工作区

```md
![PickFix 工作区](./docs/images/workspace.png)
```

建议截图内容：完整 PickFix UI，包括 Agent Chat、Live Preview、Changes 三个面板。

### 选中页面元素

```md
![选中元素](./docs/images/pick-element.png)
```

建议截图内容：Preview 面板里某个元素被高亮或选中。

### 查看和回滚变更

```md
![查看变更](./docs/images/changes-panel.png)
```

建议截图内容：Changes 面板展示修改文件、diff，以及回滚确认弹窗。

后续补充截图时可以这样做：

```bash
mkdir -p docs/images
# 保存图片为：
# docs/images/workspace.png
# docs/images/pick-element.png
# docs/images/changes-panel.png
```

然后把上面的 fenced code block 替换成普通 Markdown 图片链接即可。

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

目标项目不需要安装 PickFix 依赖。PickFix 会启动你的 dev server，代理页面，运行时注入一个小的浏览器 bridge，并让 agent 以目标项目为工作目录执行修改。

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

## 本地体验

先安装依赖。这个命令会安装 PickFix 自身，以及 `examples/` 下两个内置 demo 的依赖：

```bash
pnpm install
```

运行默认 Next.js 示例项目：

```bash
pnpm dev
```

打开：

```txt
http://localhost:3001
```

运行 Nuxt 示例项目：

```bash
pnpm dev:nuxt
```

如果你要体验的是另一个本地真实项目，而不是内置 demo，也需要先在那个项目里安装依赖：

```bash
cd /absolute/path/to/your-app
pnpm install
```

## 基础使用流程

1. 打开 `http://localhost:3001`。
2. 在 Preview 面板开启 pick 模式。
3. 点击页面中的一个元素。
4. 在 Agent Chat 里输入一个小的修改请求，例如：

   ```txt
   把这个标题改得更友好一点，并稍微放大。
   ```

5. 等待 agent 返回。
6. 观察预览热更新。
7. 在 Changes 面板查看修改文件和 diff。
8. 如果不满意，可以点击文件旁边的回滚按钮恢复。

## 在你自己的项目里使用

在 PickFix 仓库目录下运行：

```bash
pnpm pickfix -- --project /absolute/path/to/your-app --dev 'pnpm dev --port 5678' --port 5678
```

`--dev` 里的命令负责真正把目标项目启动到指定端口，`--port` 负责告诉 PickFix 去代理这个端口。两边端口建议保持一致。

Nuxt 项目示例：

```bash
pnpm pickfix -- --project /Users/me/projects/my-nuxt-app --dev 'pnpm dev --port 5678' --port 5678
```

Next.js 项目示例：

```bash
pnpm pickfix -- --project /Users/me/projects/my-next-app --dev 'pnpm exec next dev -p 5678' --port 5678
```

PickFix 会按顺序启动三个进程：

1. 你的目标项目，运行在 `--port` 指定的端口。
2. PickFix proxy，默认端口 `4000`。
3. PickFix web UI，默认端口 `3001`。

然后打开：

```txt
http://localhost:3001
```

### 如果你的 dev server 已经在运行

可以使用 `--no-dev`，并通过 `--target` 指向已有地址：

```bash
pnpm pickfix -- --project /absolute/path/to/your-app --target http://localhost:5173 --no-dev
```

### 自定义端口

```bash
pnpm pickfix -- \
  --project /absolute/path/to/your-app \
  --dev 'pnpm dev --port 5678' \
  --port 5678 \
  --proxy-port 4100 \
  --web-port 3100
```

## 开发命令

```bash
# 类型检查所有包
pnpm typecheck

# 运行测试
pnpm test

# 完整检查
pnpm check

# 只运行 web 测试
pnpm --filter @pickfix/web test
```

## Monorepo 结构

```txt
pickfix/
├── apps/
│   └── web/          # Next.js UI：chat、preview、changes panel
├── packages/
│   ├── bridge/       # 注入到 iframe 的元素选择 bridge
│   ├── cli/          # 启动 target → proxy → web
│   └── proxy/        # HTTP/WS proxy 和 bridge 注入
└── examples/
    ├── next-demo/    # 示例 Next.js 外部项目
    └── nuxt-demo/    # 示例 Nuxt 外部项目
```

## 当前限制

- Agent 的修改质量依赖选中元素的上下文和提示词是否清晰。
- 当前主要面向本地开发，不是远程部署工具。
- Changes 面板依赖 Git status/diff，因此目标项目最好在 Git 仓库内。
- Branch/worktree 管理、源码标注等能力还未实现。

## Roadmap

- [x] 通过 proxy 显示实时预览
- [x] 运行时注入 bridge
- [x] 页面元素选择
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
