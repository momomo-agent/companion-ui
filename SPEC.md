# Companion UI — Prototype Spec

## 核心概念
对话驱动的伴生式 Gen UI。Canvas 是主画面（左），对话流是控制通道（右）。
AI 说话的同时，Canvas 自动渲染对应的视觉元素。

灵感来源：Her OS1 / Mercy Maddox / JARVIS / Swan Song

## 布局
```
┌──────────────────────────┬─────────────┐
│                          │  对话流      │
│       Canvas             │  (右侧窄栏)  │
│    (主视觉区域)           │             │
│                          │  输入框      │
└──────────────────────────┴─────────────┘
         ~70%                   ~30%
```

## 设计原则
1. **Canvas 是舞台** — 不是附件，是主体
2. **对话是旁白** — 简洁，不抢注意力
3. **自动伴生** — 用户不需要操作，UI 跟着对话自然出现
4. **有呼吸感** — 元素有进入/退出动画，不是突然出现突然消失
5. **只在需要时可视化** — 纯文字能说清的不生成 UI

## 验证场景

### 场景 1：电影推荐
用户："推荐一部科幻电影"
- 对话栏：agent 文字回复
- Canvas：电影海报卡片淡入，带评分、年份、一句话简介
- 推荐多部时：卡片依次淡入排列

### 场景 2：数据/进度展示
用户："下载进度怎么样了"
- 对话栏：agent 简短回复
- Canvas：下载任务卡片，实时进度条、速度、文件名

### 场景 3：概念解释/架构
用户："解释一下 spreading activation"
- 对话栏：agent 解释
- Canvas：自动生成节点图/流程图，跟着解释逐步展开

## 技术方案

### 前端
- React + TypeScript + Vite
- Canvas 区域：动态组件渲染器
- 对话区域：简洁聊天界面
- 动画：Framer Motion（进入/退出/布局变化）
- 图表：简单 SVG 组件（不用重型库）

### Agent 协议
Agent 的回复是 JSON stream：
```json
{
  "text": "推荐《无尽》，2017年的科幻悬疑片...",
  "canvas": [
    {
      "type": "movie-card",
      "data": {
        "title": "The Endless",
        "year": 2017,
        "rating": 7.0,
        "poster": "url",
        "tagline": "两兄弟重返邪教营地"
      },
      "animation": "fade-in"
    }
  ]
}
```

### Canvas 组件类型（MVP）
1. **movie-card** — 海报 + 标题 + 评分 + 简介
2. **progress-card** — 进度条 + 速度 + 状态
3. **diagram** — Mermaid/SVG 流程图
4. **image-grid** — 图片网格（截图对比等）
5. **text-highlight** — 大字引用/关键信息卡片
6. **empty** — 清空 Canvas（回到待机状态）

### 待机状态
没有可视化内容时，Canvas 显示一个极简的"存在感"符号（致敬 OS1）

### 后端
- 简单 Express + WebSocket
- 接入现有 LLM（通过 OpenClaw 的 provider）
- System prompt 指导 agent 何时生成 canvas annotation

## 不做
- 语音交互（Phase 2）
- 移动端适配
- 用户登录/存储
- 复杂动画/3D

## 成功标准
1. 能跑起来，对话的同时 Canvas 自动渲染
2. 至少 3 种组件类型正常工作
3. 元素有进入/退出动画
4. 感觉上"对话和视觉是一体的"，不是割裂的两个区域
