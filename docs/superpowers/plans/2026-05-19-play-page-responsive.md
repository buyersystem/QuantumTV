# 播放页响应式优化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 `src/app/play/page.tsx` 的渲染层，使播放器走 16:9 自适应、双列布局从 `lg`(1024px) 起、消除重复标题、统一跳过按钮、详情区分三档响应式。

**Architecture:** 仅修改 JSX 结构和 Tailwind 类名，不改任何业务逻辑（Tauri 调用 / `useEffect` / refs / 状态机均保持原样）。所有断点统一为三档：mobile (`<lg`) / tablet+laptop (`lg`–`xl`) / desktop+wide (`xl`+/`2xl`+)。共 6 个任务，每任务一次提交。

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, TypeScript 5.8, Plyr 3.8, HLS.js 1.6。验证手段：`pnpm typecheck`、`pnpm lint:strict`、`pnpm build`，以及手动跨断点视觉走查。

**Spec:** `docs/superpowers/specs/2026-05-19-play-page-responsive-design.md`

---

## File Structure

仅修改一个文件：

- **Modify**: `src/app/play/page.tsx`
  - 第 12–28 行：新增 `cn` 工具导入
  - 第 2387–2425 行：顶部标题行（合并跳过按钮、收藏图标上移）
  - 第 2429–2498 行：删除 `xl:flex` 工具栏行（跳过按钮已迁顶部，折叠按钮迁到悬浮位）
  - 第 2500–2531 行：主网格 + 播放器容器重写（lg 起双列、aspect-video）
  - 第 2534–2557 行：选集面板 wrapper 高度链简化
  - 第 2562–2635 行：详情区重构（去重复 h1、封面 sm 起显示、简介自然撑高）

**不修改**：`EpisodeSelector.tsx`、`SkipConfigPanel.tsx`、`PageLayout.tsx`、`ui-layout.ts`、globals.css 以及 Rust 后端。

---

## 验证命令参考

| 命令 | 用途 | 期望 |
|------|------|------|
| `pnpm typecheck` | TS 类型检查 | 无错误退出码 0 |
| `pnpm lint:strict` | ESLint 0 warning | 无错误退出码 0 |
| `pnpm build` | 生产构建 | 构建成功，无报错 |
| `pnpm dev` | 启动开发服务器 | http://localhost:3000 可访问 |

跨断点手工走查清单（每次完成 UI 改动后逐个检查）：

| 视口 | 期望表现 |
|------|----------|
| 375×667 (iPhone SE) | 标题 + 跳过按钮单行不溢出；播放器贴边 16:9 |
| 390×844 (iPhone 12) | 同上，留白舒适 |
| 768×1024 (iPad Mini) | 单列流；封面小卡居中显示；简介无内部滚动 |
| 1024×768 (iPad 横屏) | 双列出现；左视频右选集（18rem）；详情区横排 |
| 1280×800 (MacBook 13") | 侧栏 22rem；视频 16:9 居中无大块空白 |
| 1920×1080 (桌面) | 侧栏 25rem；折叠后视频占满左右仅装饰留白 |
| 2560×1440 (大屏) | `pageShell` max-w 1720 居中，比例正确 |

---

### Task 1: 基线验证 + 引入 `cn` 工具

**Files:**
- Modify: `src/app/play/page.tsx:12-28`（在 imports 区添加 `cn`）

- [ ] **Step 1: 跑一遍基线 typecheck，确认开局干净**

Run:
```
pnpm typecheck
```
Expected: 退出码 0，无错误输出。如有错误，停下排查 —— 不能把已有问题误归到本次重构。

- [ ] **Step 2: 跑一遍基线 lint，确认开局干净**

Run:
```
pnpm lint:strict
```
Expected: 退出码 0，无 warning。

- [ ] **Step 3: 在 imports 中加入 `cn`**

在 `src/app/play/page.tsx` 文件中找到这一行（约第 22 行）：

```tsx
import { generateStorageKey, subscribeToDataUpdates } from '@/lib/utils';
```

替换为：

```tsx
import { cn, generateStorageKey, subscribeToDataUpdates } from '@/lib/utils';
```

- [ ] **Step 4: 再跑 typecheck，确认改动未引入问题**

Run:
```
pnpm typecheck
```
Expected: 退出码 0。

- [ ] **Step 5: 提交**

```
git add src/app/play/page.tsx
git commit -m "refactor(play): import cn utility for upcoming responsive refactor"
```

---

### Task 2: 顶部标题行重构（合并跳过按钮 + 收藏上移 + 删除详情卡重复标题）

**Files:**
- Modify: `src/app/play/page.tsx:2387-2425`（顶部标题行）
- Modify: `src/app/play/page.tsx:2566-2578`（详情卡内 `<h1>` + 收藏按钮）
- Modify: `src/app/play/page.tsx:2429-2459`（`xl:flex` 工具栏行内的跳过按钮，本步只删除该按钮；折叠按钮保留供 Task 3 处理）

- [ ] **Step 1: 替换顶部标题行（line 2387–2425）**

将这段：

```tsx
        {/* 第一行：影片标题 */}
        <div className='py-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-[834px]:gap-4'>
          <div className='min-w-0 flex-1'>
            <h1 className='truncate text-[2rem] font-bold tracking-[-0.03em] text-gray-900 max-[375px]:text-[1.8rem] sm:text-[2.25rem] min-[834px]:text-[2.5rem] min-[1440px]:text-[2.85rem] dark:text-gray-100'>
              {videoTitle || '影片标题'}
            </h1>
            {totalEpisodes > 1 && (
              <div className='mt-1.5 truncate text-sm font-medium text-gray-500 max-[375px]:text-[0.84rem] sm:text-base min-[834px]:mt-2 min-[834px]:text-lg dark:text-gray-400'>
                {detail?.episodes_titles?.[currentEpisodeIndex] ||
                  `${currentEpisodeIndex + 1} 集`}
              </div>
            )}
          </div>

          {/* 移动端跳过设置按钮 */}
          <button
            onClick={() => setIsSkipConfigPanelOpen(true)}
            className={`tap-target xl:hidden self-start shrink-0 flex items-center gap-1.5 px-3.5 py-2 max-[375px]:px-3 min-[834px]:px-4 rounded-full text-xs min-[834px]:text-sm font-medium transition-all duration-200 ${
              skipConfig.enable
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ring-1 ring-purple-500/20'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 ring-1 ring-gray-500/10'
            }`}
          >
            <svg
              className='w-3.5 h-3.5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M13 5l7 7-7 7M5 5l7 7-7 7'
              />
            </svg>
            <span>{skipConfig.enable ? '已跳过' : '跳过'}</span>
          </button>
        </div>
```

替换为：

```tsx
        {/* 第一行：影片标题 + 收藏 + 跳过设置 */}
        <div className='py-1 flex items-start justify-between gap-3 min-[834px]:gap-4'>
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2 min-w-0'>
              <h1 className='truncate text-2xl font-bold tracking-[-0.03em] text-gray-900 max-[375px]:text-xl sm:text-3xl lg:text-[2.25rem] xl:text-[2.5rem] min-[1440px]:text-[2.75rem] dark:text-gray-100'>
                {videoTitle || '影片标题'}
              </h1>
              <button
                type='button'
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFavorite();
                }}
                className='shrink-0 transition-opacity hover:opacity-80'
                aria-label={favorited ? '取消收藏' : '添加收藏'}
              >
                <FavoriteIcon filled={favorited} />
              </button>
            </div>
            {totalEpisodes > 1 && (
              <div className='mt-1.5 truncate text-sm font-medium text-gray-500 max-[375px]:text-[0.84rem] sm:text-base lg:mt-2 lg:text-lg dark:text-gray-400'>
                {detail?.episodes_titles?.[currentEpisodeIndex] ||
                  `第 ${currentEpisodeIndex + 1} 集`}
              </div>
            )}
          </div>

          {/* 跳过设置按钮（断点驱动尺寸/视觉密度） */}
          <button
            type='button'
            onClick={() => setIsSkipConfigPanelOpen(true)}
            title='设置跳过片头片尾'
            className={cn(
              'tap-target group relative flex shrink-0 items-center gap-1.5 self-start rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200',
              'lg:rounded-xl lg:px-4 lg:py-2 lg:text-sm lg:shadow-md lg:hover:shadow-lg lg:hover:scale-105',
              skipConfig.enable
                ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-500/30 dark:bg-purple-900/40 dark:text-purple-300 lg:bg-gradient-to-r lg:from-purple-600 lg:via-pink-500 lg:to-indigo-600 lg:text-white lg:ring-0'
                : 'bg-gray-100 text-gray-600 ring-1 ring-gray-500/10 dark:bg-gray-800 dark:text-gray-400 lg:bg-gradient-to-r lg:from-gray-100 lg:to-gray-200 lg:dark:from-gray-700 lg:dark:to-gray-800 lg:text-gray-700 lg:dark:text-gray-300 lg:ring-0',
            )}
          >
            <svg
              className='h-3.5 w-3.5 lg:h-5 lg:w-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M13 5l7 7-7 7M5 5l7 7-7 7'
              />
            </svg>
            <span>{skipConfig.enable ? '跳过已启用' : '跳过设置'}</span>
            {skipConfig.enable && (
              <span
                className='absolute -right-1 -top-1 hidden h-3 w-3 animate-pulse rounded-full bg-green-400 lg:block'
                aria-hidden='true'
              />
            )}
          </button>
        </div>
```

- [ ] **Step 2: 删除 `xl:flex` 工具栏行中的跳过按钮（line 2431–2459）**

找到这段（位于工具栏行 `<div className='hidden xl:flex items-center justify-between'>` 内部）：

```tsx
            {/* 跳过片头片尾设置按钮 */}
            <button
              onClick={() => setIsSkipConfigPanelOpen(true)}
              className={`tap-target group relative flex items-center space-x-2 px-4 py-2 rounded-xl bg-linear-to-r transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 ${
                skipConfig.enable
                  ? 'from-purple-600 via-pink-500 to-indigo-600 text-white'
                  : 'from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-300'
              }`}
              title='设置跳过片头片尾'
            >
              <svg
                className='w-5 h-5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M13 5l7 7-7 7M5 5l7 7-7 7'
                />
              </svg>
              <span className='text-sm font-medium'>
                {skipConfig.enable ? '✨ 跳过已启用' : '⚙️ 跳过设置'}
              </span>
              {skipConfig.enable && (
                <div className='absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse'></div>
              )}
            </button>

```

整段删除（包括上方空行和结尾分隔的空行）。**保留**外层 `<div className='hidden xl:flex items-center justify-between'>` 容器和它内部的折叠按钮，下个 Task 再处理。

注意：删除后，`justify-between` 只剩一个子元素（折叠按钮），布局会偏右，这是预期的临时状态（Task 3 会整体删除该容器）。

- [ ] **Step 3: 删除详情卡内的重复 `<h1>` 和收藏按钮（line 2566–2578）**

找到这段：

```tsx
              {/* 标题 */}
              <h1 className='mb-2 flex w-full shrink-0 items-center text-left text-[1.7rem] font-bold tracking-[-0.025em] text-slate-900 dark:text-gray-100 sm:text-[1.95rem] min-[834px]:text-[2.15rem] min-[1440px]:text-[2.35rem]'>
                {videoTitle || '影片标题'}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite();
                  }}
                  className='ml-3 shrink-0 hover:opacity-80 transition-opacity'
                >
                  <FavoriteIcon filled={favorited} />
                </button>
              </h1>

```

整段删除（包括上方 `{/* 标题 */}` 注释和结尾空行）。

- [ ] **Step 4: 跑 typecheck**

Run:
```
pnpm typecheck
```
Expected: 退出码 0。如果失败，常见原因是 JSX 闭合错误，回到 Step 1–3 检查替换是否完整。

- [ ] **Step 5: 跑 lint**

Run:
```
pnpm lint:strict
```
Expected: 退出码 0。

- [ ] **Step 6: 手动视觉走查**

启动 dev：
```
pnpm dev
```

访问 `/play?...` 任一播放页（用现有的搜索→播放流程），并在浏览器 DevTools 中：

- [ ] 切到 375×667：标题 + 收藏图标 + 跳过按钮在一行内不溢出；详情卡里不再有重复标题
- [ ] 切到 1280×800：跳过按钮变成渐变大按钮样式；详情卡里不再有标题；顶部行没有重复

走查通过后停止 dev (`Ctrl+C`)。

- [ ] **Step 7: 提交**

```
git add src/app/play/page.tsx
git commit -m "refactor(play): unify skip button, move favorite to header, remove duplicate title"
```

---

### Task 3: 主网格 + 播放器容器 + 悬浮折叠按钮（核心）

**Files:**
- Modify: `src/app/play/page.tsx:2429-2498`（删除 `xl:flex` 工具栏整行容器）
- Modify: `src/app/play/page.tsx:2500-2531`（主网格 + 播放器壳重写）

- [ ] **Step 1: 删除 `xl:flex` 工具栏整行容器**

找到这段（Task 2 之后仅剩折叠按钮在里面）：

```tsx
        {/* 折叠控制和跳过设置 - 仅在 xl 及以上屏幕显示 */}
        <div className='hidden xl:flex items-center justify-between'>
            <button
              onClick={() =>
                setIsEpisodeSelectorCollapsed(!isEpisodeSelectorCollapsed)
              }
              className='tap-target group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200'
              title={
                isEpisodeSelectorCollapsed ? '显示选集面板' : '隐藏选集面板'
              }
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                  isEpisodeSelectorCollapsed ? 'rotate-180' : 'rotate-0'
                }`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 5l7 7-7 7'
                />
              </svg>
              <span className='text-xs font-medium text-gray-600 dark:text-gray-300'>
                {isEpisodeSelectorCollapsed ? '显示' : '隐藏'}
              </span>

              {/* 精致的状态指示点 */}
              <div
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full transition-all duration-200 ${
                  isEpisodeSelectorCollapsed
                    ? 'bg-orange-400 animate-pulse'
                    : 'bg-green-400'
                }`}
              ></div>
            </button>
          </div>

```

整段删除（包括 `{/* 折叠控制和跳过设置 ... */}` 注释、整个 `xl:flex` div 及其内部的折叠按钮、以及结尾空行）。

- [ ] **Step 2: 重写主网格容器（line ~2500–2506）**

找到这段：

```tsx
          <div
            className={`grid gap-3 transition-all duration-300 ease-in-out min-[834px]:gap-5 xl:h-[70vh] xl:grid-rows-[minmax(0,1fr)] min-[1440px]:h-[78vh] 2xl:h-[80vh] ${
              isEpisodeSelectorCollapsed
                ? 'grid-cols-1'
                : 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem] min-[1440px]:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_25rem]'
            }`}
          >
```

替换为：

```tsx
          <div
            className={cn(
              'grid grid-cols-1 gap-3 transition-all duration-300 ease-in-out min-[834px]:gap-5',
              'lg:h-[68vh] lg:grid-rows-[minmax(0,1fr)] xl:h-[72vh] min-[1440px]:h-[78vh] 2xl:h-[80vh]',
              !isEpisodeSelectorCollapsed &&
                'lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_25rem]',
            )}
          >
```

- [ ] **Step 3: 重写播放器容器（line ~2508–2531）**

找到这段：

```tsx
            {/* 播放器 */}
            <div className='min-h-0 h-full transition-all duration-300 ease-in-out rounded-xl border border-white/0 dark:border-white/30'>
              <div className='group/player relative -mx-3 h-[18.5rem] min-h-[18.5rem] w-[calc(100%+1.5rem)] overflow-hidden rounded-[1.25rem] max-[375px]:-mx-2.5 max-[375px]:h-[16.5rem] max-[375px]:min-h-[16.5rem] max-[375px]:w-[calc(100%+1.25rem)] sm:mx-0 sm:h-auto sm:min-h-[17rem] sm:w-full sm:rounded-[1.15rem] md:min-h-[20rem] min-[834px]:min-h-[24rem] xl:h-full xl:min-h-[32rem] min-[1440px]:min-h-[38rem]'>
                <div
                  ref={playerContainerRef}
                  className='quantum-plyr-shell bg-black w-full h-full rounded-[1.25rem] overflow-hidden shadow-lg sm:rounded-[1.15rem]'
                ></div>

                {/* 加载中的提示 */}
                {isVideoLoading && (
                  <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-[1.25rem] sm:rounded-[1.15rem]'>
                    <div className='flex flex-col items-center gap-3'>
                      {/* <div className='w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin' /> */}
                      <span className='text-white/80 text-sm'>
                        {videoLoadingStage === 'sourceChanging'
                          ? '切换播放源...'
                          : '正在加载视频...'}
                      </span>
                    </div>
                  </div>
                )}

                {!swipeSeekOverlayPortalHost && swipeSeekOverlayNode}
              </div>
            </div>
```

替换为：

```tsx
            {/* 播放器壳：mobile/tablet 宽度驱动 16:9，lg+ 高度驱动 16:9 居中 */}
            <div className='min-h-0 h-full transition-all duration-300 ease-in-out lg:flex lg:items-center lg:justify-center'>
              <div
                className={cn(
                  'group/player relative overflow-hidden bg-black shadow-lg',
                  'rounded-[1.25rem] sm:rounded-[1.15rem]',
                  // mobile/tablet portrait：贴边 + 宽度驱动
                  '-mx-3 w-[calc(100%+1.5rem)] max-[375px]:-mx-2.5 max-[375px]:w-[calc(100%+1.25rem)] sm:mx-0 sm:w-full',
                  // 始终保持 16:9
                  'aspect-video',
                  // lg+ 改为高度驱动，宽度由比例算出
                  'lg:mx-0 lg:h-full lg:w-auto lg:max-w-full lg:max-h-full',
                )}
              >
                <div
                  ref={playerContainerRef}
                  className='quantum-plyr-shell absolute inset-0'
                />

                {/* 悬浮折叠按钮（仅 lg+，hover 显形） */}
                <button
                  type='button'
                  onClick={() =>
                    setIsEpisodeSelectorCollapsed(!isEpisodeSelectorCollapsed)
                  }
                  title={
                    isEpisodeSelectorCollapsed ? '显示选集面板' : '隐藏选集面板'
                  }
                  aria-label={
                    isEpisodeSelectorCollapsed ? '显示选集面板' : '隐藏选集面板'
                  }
                  className={cn(
                    'absolute right-3 top-3 z-30 hidden items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white opacity-0 ring-1 ring-white/20 backdrop-blur-md transition lg:flex',
                    'group-hover/player:opacity-100 focus-visible:opacity-100',
                  )}
                >
                  <svg
                    className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      isEpisodeSelectorCollapsed && 'rotate-180',
                    )}
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M9 5l7 7-7 7'
                    />
                  </svg>
                  <span>
                    {isEpisodeSelectorCollapsed ? '显示' : '隐藏'}
                  </span>
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      isEpisodeSelectorCollapsed
                        ? 'animate-pulse bg-orange-400'
                        : 'bg-green-400',
                    )}
                    aria-hidden='true'
                  />
                </button>

                {/* 加载中的提示 */}
                {isVideoLoading && (
                  <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-[1.25rem] sm:rounded-[1.15rem]'>
                    <div className='flex flex-col items-center gap-3'>
                      <span className='text-white/80 text-sm'>
                        {videoLoadingStage === 'sourceChanging'
                          ? '切换播放源...'
                          : '正在加载视频...'}
                      </span>
                    </div>
                  </div>
                )}

                {!swipeSeekOverlayPortalHost && swipeSeekOverlayNode}
              </div>
            </div>
```

- [ ] **Step 4: 跑 typecheck**

Run:
```
pnpm typecheck
```
Expected: 退出码 0。

- [ ] **Step 5: 跑 lint**

Run:
```
pnpm lint:strict
```
Expected: 退出码 0。

- [ ] **Step 6: 手动视觉走查（重点）**

启动 dev：
```
pnpm dev
```

打开播放页，在浏览器 DevTools 中逐档验证：

- [ ] **375×667**：播放器贴边 16:9（左右无白边、上下无固定像素拉伸）
- [ ] **768×1024 (iPad Mini 竖屏)**：仍是单列，播放器 16:9 满宽
- [ ] **1024×768 (iPad 横屏)**：**双列出现**；左视频在视口高度内 16:9 居中、可能出现少量左右黑边（正常）；右侧选集面板宽度约 18rem
- [ ] **1280×800**：侧栏 22rem；视频在容器中 16:9 居中
- [ ] **1920×1080**：侧栏 25rem
- [ ] **lg+ 鼠标 hover 播放器**：右上角出现折叠按钮；点击折叠后侧栏隐藏，播放器扩展；再次点击恢复

- [ ] 验证播放/暂停、手势滑动跳转、键盘快捷键、跳过片头/片尾按钮、全屏切换均正常（这些功能完全不应受影响）

走查通过后停止 dev。

- [ ] **Step 7: 提交**

```
git add src/app/play/page.tsx
git commit -m "refactor(play): switch to lg breakpoint, aspect-video player, floating fold button"
```

---

### Task 4: 选集面板 wrapper 高度链简化

**Files:**
- Modify: `src/app/play/page.tsx:2534-2557`

- [ ] **Step 1: 替换选集面板 wrapper（line ~2534–2557）**

找到这段：

```tsx
            {/* 选集和换源 - 在移动端始终显示，在 lg 及以上可折叠 */}
            <div
              className={`min-h-[23rem] max-h-[27rem] max-[375px]:min-h-[21rem] max-[375px]:max-h-[25rem] sm:min-h-[22rem] sm:max-h-[25rem] md:min-h-[24rem] md:max-h-[27rem] min-[834px]:min-h-[27rem] min-[834px]:max-h-[32rem] xl:h-full xl:min-h-0 xl:max-h-full overflow-hidden transition-all duration-300 ease-in-out ${
                isEpisodeSelectorCollapsed
                  ? 'xl:hidden xl:opacity-0 xl:scale-95'
                  : 'xl:opacity-100 xl:scale-100'
              }`}
            >
              <EpisodeSelector
                totalEpisodes={totalEpisodes}
                episodes_titles={detail?.episodes_titles || []}
                value={currentEpisodeIndex + 1}
                onChange={handleEpisodeChange}
                onSourceChange={handleSourceChange}
                currentSource={currentSource}
                currentId={currentId}
                videoTitle={searchTitle || videoTitle}
                availableSources={availableSources}
                sourceSearchLoading={sourceSearchLoading}
                sourceSearchError={sourceSearchError}
                precomputedVideoInfo={precomputedVideoInfo}
                optimizationEnabled={optimizationEnabled}
                sourceHealthMap={sourceHealthMap}
              />
            </div>
```

替换为：

```tsx
            {/* 选集和换源 - mobile/tablet 固定高度，lg+ 跟随网格高度 */}
            <div
              className={cn(
                'min-h-0 overflow-hidden transition-all duration-300 ease-in-out',
                'h-[28rem] max-[375px]:h-[24rem] sm:h-[26rem] min-[834px]:h-[30rem] lg:h-full',
                isEpisodeSelectorCollapsed && 'lg:hidden',
              )}
            >
              <EpisodeSelector
                totalEpisodes={totalEpisodes}
                episodes_titles={detail?.episodes_titles || []}
                value={currentEpisodeIndex + 1}
                onChange={handleEpisodeChange}
                onSourceChange={handleSourceChange}
                currentSource={currentSource}
                currentId={currentId}
                videoTitle={searchTitle || videoTitle}
                availableSources={availableSources}
                sourceSearchLoading={sourceSearchLoading}
                sourceSearchError={sourceSearchError}
                precomputedVideoInfo={precomputedVideoInfo}
                optimizationEnabled={optimizationEnabled}
                sourceHealthMap={sourceHealthMap}
              />
            </div>
```

- [ ] **Step 2: 跑 typecheck**

Run:
```
pnpm typecheck
```
Expected: 退出码 0。

- [ ] **Step 3: 跑 lint**

Run:
```
pnpm lint:strict
```
Expected: 退出码 0。

- [ ] **Step 4: 手动视觉走查**

启动 dev，逐档检查选集面板：

- [ ] **375×667**：面板高约 24rem，内部可滚动
- [ ] **768×1024**：面板高约 30rem
- [ ] **1024×768 (lg+)**：面板高度跟随网格（68vh），内部滚动
- [ ] **lg+ 点击折叠按钮**：面板消失，主网格变单列，播放器扩展

- [ ] **Step 5: 提交**

```
git add src/app/play/page.tsx
git commit -m "refactor(play): simplify episode panel height classes"
```

---

### Task 5: 详情区重构（去重复 + 封面 sm 起显示 + 简介自然撑高）

**Files:**
- Modify: `src/app/play/page.tsx:2561-2635`

- [ ] **Step 1: 替换整个详情区（line ~2561–2635）**

找到这段：

```tsx
        {/* 详情展示 */}
        <div className='grid grid-cols-1 gap-4 min-[834px]:gap-5 xl:grid-cols-5 xl:gap-6'>
          {/* 文字区 */}
          <div className='xl:col-span-3'>
            <div className='flex min-h-0 flex-col rounded-2xl bg-white/50 p-5 backdrop-blur-sm max-[375px]:p-4 min-[834px]:p-6 min-[1440px]:p-7 dark:bg-white/5'>
              {/* 关键信息行 */}
              <div className='mb-4 flex shrink-0 flex-wrap items-center gap-3 text-sm min-[834px]:text-base min-[1440px]:text-[1.05rem] text-slate-700 dark:text-gray-300'>
                {detail?.class && (
                  <span className='text-green-600 dark:text-green-400 font-semibold'>
                    {detail.class}
                  </span>
                )}
                {(detail?.year || videoYear) && (
                  <span className='text-gray-600 dark:text-gray-400'>
                    {detail?.year || videoYear}
                  </span>
                )}
                {detail?.source_name && (
                  <span className='border border-gray-400 dark:border-gray-500 px-2 py-px rounded text-gray-700 dark:text-gray-300'>
                    {detail.source_name}
                  </span>
                )}
                {detail?.type_name && (
                  <span className='text-gray-600 dark:text-gray-400'>
                    {detail.type_name}
                  </span>
                )}
              </div>
              {/* 剧情简介 */}
              {detail?.desc && (
                <div
                  className='mt-0 text-base leading-relaxed text-slate-700 dark:text-gray-300 overflow-y-auto pr-2 flex-1 min-h-0 scrollbar-hide'
                  style={{ whiteSpace: 'pre-line' }}
                >
                  {detail.desc}
                </div>
              )}
            </div>
          </div>

          {/* 封面展示 */}
          <div className='hidden xl:order-first xl:col-span-2 xl:block'>
            <div className='px-0 py-2 xl:pr-6'>
              <div className='relative bg-gray-300 dark:bg-gray-700 aspect-2/3 flex items-center justify-center rounded-xl overflow-hidden'>
                {videoCover ? (
                  <>
                    <img
                      src={proxiedCoverUrl}
                      alt={videoTitle}
                      className='w-full h-full object-cover'
                    />
                  </>
                ) : (
                  <span className='text-gray-600 dark:text-gray-400'>
                    封面图片
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
```

替换为：

```tsx
        {/* 详情展示 */}
        <section className='grid grid-cols-1 gap-4 min-[834px]:gap-5 lg:grid-cols-5 lg:gap-6 min-[1440px]:gap-8'>
          {/* 封面：sm 起以小卡显示，lg+ 回到左侧 2/5 大卡 */}
          <div className='hidden sm:block lg:order-first lg:col-span-2'>
            <div className='relative mx-auto aspect-2/3 max-w-[12rem] overflow-hidden rounded-xl bg-gray-300 dark:bg-gray-700 sm:max-w-[16rem] lg:mx-0 lg:mr-0 lg:max-w-none xl:mr-6'>
              {videoCover ? (
                <img
                  src={proxiedCoverUrl}
                  alt={videoTitle}
                  className='h-full w-full object-cover'
                />
              ) : (
                <span className='absolute inset-0 flex items-center justify-center text-gray-600 dark:text-gray-400'>
                  封面图片
                </span>
              )}
            </div>
          </div>

          {/* 元信息 + 简介 */}
          <div className='lg:col-span-3'>
            <div className='rounded-2xl bg-white/50 p-5 backdrop-blur-sm max-[375px]:p-4 lg:p-6 min-[1440px]:p-7 dark:bg-white/5'>
              <div className='mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm min-[834px]:text-base min-[1440px]:text-[1.05rem] text-slate-700 dark:text-gray-300'>
                {detail?.class && (
                  <span className='font-semibold text-green-600 dark:text-green-400'>
                    {detail.class}
                  </span>
                )}
                {(detail?.year || videoYear) && (
                  <span className='text-gray-600 dark:text-gray-400'>
                    {detail?.year || videoYear}
                  </span>
                )}
                {detail?.source_name && (
                  <span className='rounded border border-gray-400 px-2 py-px text-gray-700 dark:border-gray-500 dark:text-gray-300'>
                    {detail.source_name}
                  </span>
                )}
                {detail?.type_name && (
                  <span className='text-gray-600 dark:text-gray-400'>
                    {detail.type_name}
                  </span>
                )}
              </div>
              {detail?.desc && (
                <p className='whitespace-pre-line text-base leading-relaxed text-slate-700 dark:text-gray-300'>
                  {detail.desc}
                </p>
              )}
            </div>
          </div>
        </section>
```

- [ ] **Step 2: 跑 typecheck**

Run:
```
pnpm typecheck
```
Expected: 退出码 0。

- [ ] **Step 3: 跑 lint**

Run:
```
pnpm lint:strict
```
Expected: 退出码 0。

- [ ] **Step 4: 手动视觉走查**

启动 dev，逐档检查详情区：

- [ ] **375×667**：仅显示元信息条 + 简介卡（无封面），简介自然撑高，无内部滚动条
- [ ] **640×960 (sm)**：封面以居中小卡形式出现在元信息上方（max-w-12rem）
- [ ] **834×1112 (min-[834px])**：封面 sm 大小（max-w-16rem）
- [ ] **1024×768 (lg)**：封面回到左侧 2/5、信息区右侧 3/5，aspect-2/3 完整显示
- [ ] **1440×900**：留白扩大，比例正常

- [ ] **Step 5: 提交**

```
git add src/app/play/page.tsx
git commit -m "refactor(play): redesign detail section with three-tier responsive cover"
```

---

### Task 6: 终验

**Files:** （只读 / 只验证）

- [ ] **Step 1: 完整 typecheck**

Run:
```
pnpm typecheck
```
Expected: 退出码 0。

- [ ] **Step 2: 完整 lint**

Run:
```
pnpm lint:strict
```
Expected: 退出码 0。

- [ ] **Step 3: 生产构建**

Run:
```
pnpm build
```
Expected: 构建成功，无错误。注意 Tailwind 4 编译应正常生成所有 lg:/xl:/2xl: 类。

- [ ] **Step 4: 验收清单走查**

启动 dev：
```
pnpm dev
```

逐项确认（依据 spec 的验收标准）：

- [ ] **iPhone SE (375×667)**：标题 + 跳过按钮单行不溢出；播放器贴边 16:9；选集面板自然滚动；详情区无封面、元信息 + 简介
- [ ] **iPhone 12 (390×844)**：同上，留白舒适
- [ ] **iPad Mini 竖屏 (768×1024)**：单列流；封面小卡居中显示；简介无内部滚动
- [ ] **iPad 横屏 (1024×768)**：双列出现；左视频右选集（18rem）；详情区横排；封面占左 2/5
- [ ] **MacBook 13" (1280×800)**：侧栏 22rem；视频在视口内 16:9 居中，无大块空白
- [ ] **桌面 1920×1080**：侧栏 25rem；折叠按钮 hover 出现；折叠后视频占满
- [ ] **桌面 2560×1440**：`pageShell` max-w 1720 居中，比例正确

功能回归（每档至少抽查 1–2 个）：

- [ ] 播放/暂停（点击 + 空格 + 双击）
- [ ] 手势：左右滑动跳转、单击/双击切换播放暂停
- [ ] 键盘：← → 跳转、↑ ↓ 音量、F 全屏、Alt+← Alt+→ 上下集
- [ ] 跳过设置按钮：打开面板、设置片头/片尾、清除
- [ ] 收藏：点击切换、状态持久
- [ ] 集数切换：选集、上一集、下一集
- [ ] 换源：从换源面板切换
- [ ] 全屏：F 键 / 按钮
- [ ] 折叠（仅 lg+）：hover 出现按钮、点击折叠/展开

- [ ] **Step 5: （可选）提交校验通过的标记**

如果以上全部通过，无需额外提交（前面五个 Task 各自已提交）。

如果走查中发现问题，回到对应 Task 修复，再提一个 `fix(play): ...` 的小提交，不要 amend。

---

## Self-Review 自审

1. **Spec coverage（每章对应任务）**：
   - 第一章 断点与网格骨架 → Task 3 Step 2
   - 第二章 标题/收藏/跳过 → Task 2 Step 1–3
   - 第二章 折叠按钮悬浮化 → Task 3 Step 3（按钮 JSX）+ Step 1（删除旧位置）
   - 第三章 播放器 16:9 + 选集面板宽度 → Task 3 Step 2–3 + Task 4
   - 第四章 详情区三档 → Task 5
   - 第五章 约束/验收 → Task 6 全部 Steps
   - ✅ 全覆盖

2. **占位符扫描**：无 TBD / TODO / "类似 Task N" / "适当的错误处理" 等。✅

3. **类型一致性**：
   - `cn` 来自 `@/lib/utils`，Task 1 引入后全程使用 ✅
   - `FavoriteIcon`、`handleToggleFavorite`、`setIsSkipConfigPanelOpen`、`setIsEpisodeSelectorCollapsed` 等符号未改名 ✅
   - `playerContainerRef`、`isVideoLoading`、`videoLoadingStage`、`swipeSeekOverlayPortalHost`、`swipeSeekOverlayNode` 都沿用 ✅
   - `skipConfig.enable`、`favorited` 等状态字段未改 ✅

4. **顺序依赖**：
   - Task 2 的 Step 2 删除工具栏内的跳过按钮，但保留外层 `xl:flex` div 和折叠按钮（防止丢失功能）
   - Task 3 的 Step 1 才删除整个工具栏 div，并在 Step 3 立刻添加替代的悬浮折叠按钮
   - 每个 Task 完成后页面都可用（不会出现"无折叠按钮"的中间状态） ✅

5. **风险二次确认**：
   - Plyr 容器维度：新结构下 `playerContainerRef` 始终是 `absolute inset-0` 撑满父元素，Plyr 不需要关心父元素如何被定位（aspect-video / flex-center）✅
   - 手势绑定 `resolveGestureTarget`：仍然查询 `playerContainerRef.current` 的 `.plyr` root；MutationObserver 已在监听容器变化 ✅
   - `swipeSeekOverlayPortalHost` 的 portal：依赖 `resolvePlayerFullscreenElement`，与新容器层级无关 ✅
   - 旧的 `border border-white/0 dark:border-white/30` 装饰：已在 Task 3 Step 3 删除（视觉上几乎不可见，spec 未要求保留） ✅

OK，全部就绪。
