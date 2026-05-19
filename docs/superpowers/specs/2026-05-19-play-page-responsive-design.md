# 播放页响应式优化设计

- **日期**：2026-05-19
- **范围**：`src/app/play/page.tsx`
- **目标**：更好地适配多分辨率与多尺寸（移动 / 平板 / 桌面），优先解决 1024–1440px 段表现不佳的问题。
- **不在范围**：`EpisodeSelector`、`SkipConfigPanel`、`PageLayout`、`ui-layout.ts` 等公共组件，本次不动。

## 背景

当前 `src/app/play/page.tsx`（约 2697 行）在响应式上存在以下问题：

1. **播放器高度采用六层 `min-h` 链**（`h-[18.5rem]` → `min-h-[38rem]`），与真实视频比例脱钩，在多种尺寸下出现裁切或留白。
2. **断点混用**：同时使用 Tailwind 默认（`sm`/`md`/`lg`/`xl`）和项目自定义断点（`max-[375px]` / `min-[834px]` / `min-[1440px]`），心智成本高。
3. **双列布局切换点过晚**：播放器 + 选集在 `xl:`(1280px) 才并排，导致 1024–1280px 区段（iPad 横屏、13" 笔记本）出现大量垂直堆叠空白。
4. **重复标题**：页面顶部 `<h1>` 与详情卡片各显示一次同样的标题。
5. **小屏完全隐藏封面**：详情区封面用 `hidden xl:block`，手机/平板看不到封面。
6. **两个独立的跳过按钮**：`xl:flex` 一个、`xl:hidden` 一个，状态/视觉不一致。
7. **简介容器使用 `overflow-y-auto + flex-1 min-h-0`**：在移动端会出现奇怪的内部滚动条。

## 用户已确认的关键决策

- 重点优化区段：**平板横屏 / 小笔记本 (1024–1440px)**
- 播放器高度策略：**按 16:9 视频比例自适应**
- 标题处理：**只保留顶部标题，详情卡去掉重复标题**
- 双列起始断点：**从 `lg`(1024px) 开始**

## 采用方案：务实重组（方案 C）

保留全局断点约定（`max-[375px]` 处理小屏特例、`min-[1440px]` 处理大屏），把本页内部"乱用 sm/md/lg/xl"的部分理顺成清晰的三档（手机 → `lg` 平板/小笔记本 → `xl`/`2xl` 桌面/大屏），播放器走 `aspect-video` 自适应，并排布局在 `lg` 开启，移除详情卡重复标题，把收藏按钮放到顶部标题旁。

排除的方案：
- **方案 A（最小改动）**：仅切断点不重构容器，断点体系仍然混乱。
- **方案 B（整段重构 + container queries）**：改动面过大，可能污染共享类，偏离"只优化播放页"的目标。

## 设计

### 第一章 · 断点策略与布局骨架

**三档语义化分界**（仅作用于本页内部）：

| 档位 | 区段 | 行为 |
|------|------|------|
| Mobile | `<1024px` | 单列流，播放器贴边全宽 16:9，选集面板在播放器下方 |
| Tablet/Laptop | `lg:` `1024–1280px` | 双列开始，左视频右选集，侧栏 `18rem` |
| Desktop | `xl:` `1280–1440px` | 侧栏 `22rem`，详情区开启横向布局 |
| Wide | `2xl:`/`min-[1440px]` | 侧栏 `25rem`，整体留白上扩 |

**主体网格**（替换当前 `xl:grid-cols-[minmax(0,1fr)_22rem]`）：

```
grid grid-cols-1
lg:grid-cols-[minmax(0,1fr)_18rem]
xl:grid-cols-[minmax(0,1fr)_22rem]
2xl:grid-cols-[minmax(0,1fr)_25rem]
```

**整体容器高度策略**：

- Mobile：自然流，播放器 + 选集各自占自然高度。
- `lg+`：固定 `h-[calc(100dvh-var(--app-top-offset)-2rem)]`，最高 `78vh`；让播放器在该高度内由 `min-h-0` + `aspect-video` 自然计算宽度，避免空白和裁切。

### 第二章 · 标题与顶部工具栏

**目标**：消除重复标题、收藏按钮上移、跳过按钮单一化。

#### 顶部行新结构

```
┌────────────────────────────────────────────────────────────────┐
│  影片标题 ♥                       [跳过设置 ⏭]                 │
│  第 3 集 · 简介标题                                            │
└────────────────────────────────────────────────────────────────┘
```

- 左：`<h1>` 标题 + 收藏图标（紧贴标题右侧）
- 标题下方：第 N 集 / `episodes_titles[idx]`（仅多集时显示）
- 右：单一"跳过设置"按钮（所有断点统一一个，状态以颜色 + 脉冲点区分）

#### 字号梯度

| 断点 | 标题字号 |
|------|---------|
| `max-[375px]` | `text-2xl` (1.5rem) |
| 默认（mobile） | `text-[1.75rem]` |
| `sm` (640+) | `text-3xl` (1.875rem) |
| `lg` (1024+) | `text-[2.25rem]` |
| `xl` (1280+) | `text-[2.5rem]` |
| `2xl`/`min-[1440px]` | `text-[2.75rem]` |

（当前 mobile 是 `2rem`、`375` 下 `1.8rem`，对小屏偏大，标题容易吃两行。）

#### 单一跳过按钮

将原本 `xl:flex` 大渐变按钮和 `xl:hidden` 小 pill 合并为一个按钮，通过断点切换尺寸与视觉密度：

```tsx
<button
  className={cn(
    'tap-target flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition',
    'lg:rounded-xl lg:px-4 lg:py-2 lg:text-sm lg:shadow-md',
    skipConfig.enable
      ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-500/30 lg:bg-gradient-to-r lg:from-purple-600 lg:via-pink-500 lg:to-indigo-600 lg:text-white lg:ring-0'
      : 'bg-gray-100 text-gray-600 ring-1 ring-gray-500/10 dark:bg-gray-800 dark:text-gray-400 lg:bg-gradient-to-r lg:from-gray-100 lg:to-gray-200 lg:dark:from-gray-700 lg:dark:to-gray-800 lg:text-gray-700 lg:dark:text-gray-300'
  )}
>
  <SkipIcon className='h-3.5 w-3.5 lg:h-5 lg:w-5' />
  <span>{skipConfig.enable ? '跳过已启用' : '跳过设置'}</span>
</button>
```

#### 收藏按钮迁移

从详情卡（当前 line 2569–2577）移到顶部标题旁；详情卡只保留元信息（年份/类型/源/分类）+ 简介。

#### 折叠按钮位置改造

当前在 `xl:flex` 工具栏行（line 2429–2498），**该行整体删除**：

- 跳过按钮迁到顶部行。
- 折叠按钮迁到**播放器右上角悬浮**（仅 `lg+`），点击折叠 / 展开右侧选集面板。
- 折叠状态指示点保留（橙色脉冲 = 已折叠 / 绿色稳态 = 展开）。

`lg+` 桌面端节省了一整行垂直空间，播放器可以再高一些。

### 第三章 · 播放器与选集面板

#### 播放器容器：16:9 自适应

**Mobile / Tablet portrait (`<lg`)** —— 纯 16:9：

```tsx
<div className="relative -mx-3 sm:mx-0 aspect-video w-[calc(100%+1.5rem)] sm:w-full overflow-hidden rounded-[1.25rem] sm:rounded-[1.15rem] bg-black shadow-lg">
  <div ref={playerContainerRef} className="quantum-plyr-shell absolute inset-0" />
</div>
```

- 不再有 `min-h` / `h-[...rem]`；宽度决定高度。
- 贴边在 mobile 保留（`-mx-3`），平板及以上正常对齐。

**Desktop (`lg+`)** —— 视口高度内 16:9 居中：

```tsx
<div className="relative flex h-full min-h-0 items-center justify-center overflow-hidden rounded-[1.15rem] bg-black shadow-lg">
  <div className="aspect-video max-h-full w-auto max-w-full">
    <div ref={playerContainerRef} className="quantum-plyr-shell h-full w-full" />
  </div>
</div>
```

- 外层固定视口高度（由网格的 `lg:h-[calc(100dvh-...)]` 给定）。
- 内层 `aspect-video max-h-full` 保证 16:9 并贴顶/贴底，宽度自动。
- 出现左右黑边（当视口宽高比 < 16:9）也比拉伸/裁切好。

#### 悬浮折叠按钮（lg+）

替代被删除的工具栏行的折叠控件，位置右上角，仅 `lg+` 渲染：

- 默认 `pointer-events-none` 半透明，鼠标进入播放器容器时显形（沿用 `.group/player` 已有约定）。
- 避开 Plyr 设置菜单的展开方向（右下角）。
- 状态指示点保留。

#### 选集面板（右侧）

**宽度梯度**：

```
lg:grid-cols-[minmax(0,1fr)_18rem]
xl:grid-cols-[minmax(0,1fr)_22rem]
2xl:grid-cols-[minmax(0,1fr)_25rem]
```

**面板高度**：

- Mobile / Tablet：`h-[28rem]` 自然滚动。
- `lg+`：`h-full min-h-0`，内部 overflow。

替换当前 line 2535 一长串 `min-h` / `max-h` 链为：

```tsx
<div className={cn(
  'min-h-0 overflow-hidden transition-all duration-300 ease-in-out',
  'h-[28rem] lg:h-full',
  isEpisodeSelectorCollapsed && 'lg:hidden'
)}>
  <EpisodeSelector ... />
</div>
```

#### 折叠态下的播放器扩展

当 `isEpisodeSelectorCollapsed === true`（仅 `lg+` 生效）：

- 网格变 `lg:grid-cols-1`。
- 播放器内层 `aspect-video` 仍居中，但允许更大宽度（max 由 `h * 16/9` 自然限制）。
- 视觉效果：左右出现更宽的留白，播放器更大。

#### 加载遮罩与手势提示

- `isVideoLoading` 遮罩：保留，定位调整为新的 `aspect-video` 容器内部，圆角同步。
- `swipeSeekOverlayNode`：保留逻辑，CSS 调整为相对新的 `aspect-video` 容器。
- `swipeSeekOverlayPortalHost` portal 目标依旧是 `resolvePlayerFullscreenElement`，与包装层无关。

### 第四章 · 详情区（封面 + 元信息 + 简介）

#### 响应式三档

| 断点 | 布局 |
|------|------|
| `<sm` (手机) | 单列：紧凑元信息条 + 简介；封面隐藏（节省垂直空间） |
| `sm – lg` (平板竖屏/小屏) | 单列：小尺寸横向封面卡 + 元信息 + 简介 |
| `lg+` (桌面) | 双列：左 2/5 封面（aspect-2/3），右 3/5 元信息 + 简介 |

#### 结构骨架

```tsx
<section className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6 min-[1440px]:gap-8">
  {/* 封面 */}
  <div className="hidden sm:block lg:order-first lg:col-span-2">
    <div className="relative mx-auto aspect-[2/3] max-w-[12rem] overflow-hidden rounded-xl bg-gray-300 dark:bg-gray-700 sm:max-w-[16rem] lg:mx-0 lg:max-w-none">
      {proxiedCoverUrl ? (
        <img src={proxiedCoverUrl} alt={videoTitle} className="h-full w-full object-cover" />
      ) : <FallbackCover />}
    </div>
  </div>

  {/* 元信息 + 简介 */}
  <div className="lg:col-span-3">
    <div className="rounded-2xl bg-white/50 p-5 backdrop-blur-sm dark:bg-white/5 lg:p-6 min-[1440px]:p-7">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm lg:text-base">
        {/* class / year / source / type */}
      </div>
      {detail?.desc && (
        <p className="whitespace-pre-line text-base leading-relaxed text-slate-700 dark:text-gray-300">
          {detail.desc}
        </p>
      )}
    </div>
  </div>
</section>
```

#### 关键改动

- 删除当前 line 2567–2578 的 `<h1>` 与收藏按钮（已迁到顶部）。
- 简介不再用 `overflow-y-auto + flex-1 min-h-0`，自然撑高即可（避免 mobile 上奇怪的内部滚动条）。
- 封面在 `sm` 起以**居中小卡**形式出现，到 `lg` 才回到左侧大卡。

### 第五章 · 实施约束与风险

#### 不改逻辑，只改样式 + DOM 结构

**保持不变**：

- 所有 Tauri 命令调用（`initialize_player_view`、`apply_skip_config`、`player_tick` 等）。
- 所有 `useEffect` 业务逻辑（手势、键盘、Wake Lock、播放进度、HLS 初始化、Plyr 初始化）。
- `enhancePlyrUi` 内部的 Plyr 控件注入（仅播放器容器变了，子内容不变）。
- 状态变量、Ref、订阅、清理。

**改动范围**：

- JSX 结构（line 2382–2660 之间的渲染部分）。
- Tailwind 类名。
- `isEpisodeSelectorCollapsed` 状态保留，仅控件位置改变（从工具栏行移到播放器悬浮按钮）。

#### 风险点与缓解

| 风险 | 缓解 |
|------|------|
| Plyr 控件依赖固定高度容器 | 用 `aspect-video` 包装层，内部仍是 100% 宽高，Plyr 不感知差异 |
| Hls.js loader 不感知容器变化 | loader 不依赖 DOM，安全 |
| 手势监听绑定到 `.plyr` root | `resolveGestureTarget`（line 1160–1166）会重新查询；MutationObserver 已在监听 |
| 全屏元素查找 `playerContainerRef.current?.contains` | 容器层级仅多一层 `aspect-video` 包装，`contains` 仍有效 |
| `swipeSeekOverlayPortalHost` 的 portal 目标 | portal 目标是 `resolvePlayerFullscreenElement`，与包装层无关 |
| 悬浮折叠按钮可能挡住 Plyr 设置菜单 | 仅 `lg+` 渲染，定位避开 Plyr 设置菜单展开方向 |
| 移动端 `-mx-3` 贴边在桌面被取消 | 用 `sm:mx-0` 显式覆盖 |

#### YAGNI（明确不做）

- ❌ 不引入 CSS container queries。
- ❌ 不改 `appLayoutClasses.pageShell` 或其他共享类。
- ❌ 不动 `EpisodeSelector` 组件内部。
- ❌ 不动 `SkipConfigPanel`。
- ❌ 不引入 `clamp()` 字号。
- ❌ 不引入新依赖。

#### 验收标准

| 设备/尺寸 | 验收点 |
|----------|--------|
| iPhone SE (375×667) | 标题 + 跳过按钮单行不溢出；播放器贴边 16:9；选集面板自然滚动 |
| iPhone 12 (390×844) | 同上，留白舒适 |
| iPad Mini 竖屏 (768×1024) | 单列流；封面小卡居中显示；简介无内部滚动 |
| iPad 横屏 (1024×768) | **双列出现**；左视频右选集（18rem）；详情区横排；封面占左 2/5 |
| MacBook 13" (1280×800) | 侧栏 22rem；视频在视口内 16:9 居中，无大块空白 |
| 桌面 1920×1080 | 侧栏 25rem；折叠后视频占满，左右仅装饰留白 |
| 桌面 2560×1440 | `pageShell` 自身 max-w 1720 居中，比例正确 |

#### 提交边界

**单一 PR / 单次提交**：文件改动仅限 `src/app/play/page.tsx`。不动 `EpisodeSelector.tsx`、`SkipConfigPanel.tsx`、`PageLayout.tsx`、`ui-layout.ts`。

## 后续

设计获得用户确认后，调用 `superpowers:writing-plans` 技能生成分步实施计划，再进入编码阶段。
