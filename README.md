# project-task-manager — 项目级待办任务管理插件（开发文档）

版本说明
- 插件名：project-task-manager
- 目标平台：Obsidian（Community plugin）
- 策略：主体采用独立解析与索引（遍历 vault，正则识别任务），并在设置中提供“如果仓库安装了 Tasks，则启用增强集成”选项。参考并兼容 obsidian-tasks 的能力与限制（但不依赖其查询 API）。

目的与定位
- 是什么？
  - project-task-manager，基于待办任务（task/todo/checklist）的项目管理插件，将 Vault 中散落的任务按“项目 → 阶段 → 任务”聚合，提供项目概况、进度视图、任务树、项目文档视图与报表能力（支持 AI 辅助摘要为可选功能）。
- 用途（核心需求）
  - 展示项目概况
    - 总项目数、进行中项目、今日/本周/本月待办、逾期待办等总体统计；
    - 周报 / 月报 / 年报导出与（可选）AI 生成自然语言摘要；
  - 展示项目进度
    - 条目式展示进行中的项目（项目名称、开始/结束时间、当前阶段、进度条、未完成任务数、逾期待办数、本周完成数等）；
    - 支持自定义阶段序列（支持空项），并以阶段顺序作为进度和分组依据；
    - 每个项目显示为一条卡片，最多显示 3 条项目（超出滚动显示）；
  - 展示待办任务
    - 按项目显示待办任务清单，可选择项目切换查看；
    - 从全库识别并汇集与项目相关的待办任务（基于标签/tag 识别）；
    - 标签层级映射为阶段/任务层级（支持多级：一级/二级/三级...）；
    - 任务按树状展示（缩进与层级）并支持筛选与统计（可结合 Tasks 插件的能力增强）；
  - 展示项目文档
    - 使用文档 frontmatter / metadata 识别项目与阶段（例如文件属性包含 `#项目管理/水环境评估/前期准备`）；
    - 文档与任务按同样的层级规则树状展示，支持排序（例如数字类属性序号）；
    - 待办任务视图与项目文档视图可通过标签页切换，共用同一展示区域。

项目阶段范例（默认阶段与可定制）
- 默认阶段（示例，可配置 / 支持任意序列和空项）：
  - 前期准备：思路谋划 / 方案设计 / 项建书 / 立项 等；
  - 预算管理：预算申报 / 预算审批 / 预算下达；
  - 项目招标：三重一大/招标代理/招标公告/招标评审/中标/合同签订；
  - 实施推进：启动会 / 推进会 / 初稿审核 / 优化完善 / 施工推进；
  - 竣工收尾：送审稿 / 验收 / 成果交付 / 结款 / 归档（项目完结）；
  - 成果应用：不计入进度核心统计，但作为后续任务/成果跟进项。
- 要求：阶段名称与顺序可由用户自定义，允许空阶段（占位）。

数据模型（本地解析核心模型）
- Project {
    id: string,
    name: string,
    tagPrefix: string[] 或 string, // 识别用标签，如 "#项目管理/水环境评估"
    stages: Stage[],
    startDate?: Moment,
    endDate?: Moment,
    totalTasks: number,
    openTasks: number,
    overdueTasks: number,
    completedThisWeek: number,
    docs: ProjectDoc[] // 项目相关文档索引
  }
- Stage { name: string, level: number, tasks: TaskLite[] }
- TaskLite {
    id: string (file+line 或唯一伪 id),
    description: string,
    status: string, // todo / in-progress / done / cancelled / custom
    tags: string[],
    filePath: string,
    lineNumber: number,
    indentLevel: number,
    dueDate?: Moment | null,
    scheduledDate?: Moment | null,
    priority?: string,
    recurrenceText?: string,
    dependsOn?: string[],
    rawLine: string
  }
- ProjectDoc { path: string, title: string, frontmatter: Record, stageTags: string[] }

任务识别与解析规则（实现细节）
- 支持行格式（优先支持常见）：
  - "- [ ] ...", "* [ ] ...", "1. [ ] ...", 以及缩进列表任务；
- 正则示例（PoC，用于实现）：
  - TASK_LINE_REGEX = /^(\s*)([-*+]|\d+\.)\s*\[([ xX\-/\+?])\]\s*(.*)$/
  - 提取 indentation、marker、statusSymbol、body；
- 标签识别：
  - 识别 inline tag（`#项目管理/水环境评估`），并支持分层（split by '/'）；
  - 项目识别默认基于 tag 前缀（可配置）；
- 日期解析：
  - 使用 chrono.parseDate + window.moment()（与 Tasks 一致，兼容性最好）解析 inline 日期、emoji 日期等；
- 层级映射策略：
  - 优先使用 tag 层级将任务归属到项目与阶段（可选 fallback 使用缩进层级）；
  - 支持 N 级层级映射（配置中设定项目深度）。

索引策略与增量更新
- 初次全量索引
  - onload/onLayoutReady 时后台分批扫描 Vault（app.vault.getMarkdownFiles），按 batch（例如 50）异步读取与解析；
- 增量更新
  - 订阅 app.metadataCache.on('changed')、vault.on('rename')、vault.on('delete') 等事件，进行单文件增量索引或移除；
  - 使用 mutex 或队列保证并发安全与顺序处理；
- 缓存与持久化
  - 内存缓存 TaskLite[]、Project 索引；必要时保存至插件 data （this.saveData）做重启加速；
- 性能优化
  - 提供文件夹白名单 / 黑名单设定、最大索引数配置、后台低优先级索引与用户可触发的“重建索引”。

与 obsidian-tasks 的“增强集成”（可选）
- 目标：在检测到用户安装并同意启用 obsidian-tasks 时，优先/增量使用 Tasks 的成熟解析与 UI 能力，但不依赖其 query API。
- 可用增强点（当用户启用并 Tasks 可用时）：
  - 使用 tasksPlugin.getTasks() 获取 Tasks 已解析的 Task[]（包含 richer fields：dueDate、recurrence、occurrence、urgency、dependsOn、id 等），作为本插件的高质量输入数据（加速与提高准确性）。
  - 使用 tasksPlugin.apiV1.createTaskLineModal / editTaskLineModal 提供一致的任务创建/编辑 Modal UX。
  - 使用 tasksPlugin.apiV1.executeToggleTaskDoneCommand(line, path) 做行级 toggle 转换（正确处理 recurring / onCompletion 语义）。
  - 在可能的情况下订阅 Tasks 的 cache/events（若可访问）以响应 Tasks 索引变化、避免重复扫描。
- 重要限制（必须知晓）：
  - Tasks 的官方 APIv1 并不支持“以 programmatic 方式运行 ```tasks``` 查询并返回结果”——因此必须在本插件内实现筛选/分组/聚合逻辑（即便使用 Tasks 的 Task[] 作为输入）。
  - tasksPlugin.getTasks() 属于插件实例方法（源码可见），但不在 APIv1 文档化保证范围内；使用需 feature-detect 并在设置中提供回退（用户可禁用 Tasks 增强）。
  - editTaskLineModal() 在某些场景返回空字符串（取消或 onCompletion delete），集成时需处理歧义。

UI 设计（主视图为侧边栏，也支持全窗）
- 总体布局（自上而下）：
  1. 总项目概况（Dashboard）：库中所有项目的总体统计（总项目数/进行中/今日/本周/逾期等）；
  2. 单项目概况（卡片）：进度条、项目名称、开始时间、完结时间、当前阶段、待办数、逾期待办数（卡片形式，最多显示 3 个卡片，超出滚动）；
  3. 项目选择菜单（下拉或搜索选择项目）；
  4. 主视图区（tab 切换）：
     - 待办任务：按项目阶段/级别/顺序树状展示任务（从上到下，支持展开/折叠、跳转到源文件、切换任务状态、编辑）；
     - 项目文档：按层级展示项目相关文档（按 frontmatter/标签识别并排序）；
- 交互细节
  - 项目卡片最多预览 3 条任务（点击展开显示更多）；
  - 任务条目右键菜单：标为完成 / 编辑（调用 Tasks modal 或本地编辑） / 跳转到文件 / 移动阶段 / 添加备注；
  - 支持筛选器（日期范围 / 标签 / 优先级 / 阶段）与搜索框；
  - 周报按钮：导出 Markdown 或调用 AI 生成摘要（用户可配置 AI 提供商与隐私控制）。
- 视觉设计要求
  - 卡片、进度条、标签应可配置主题样式并尽量简洁、优雅，留白与信息层次清晰。
  - 支持小窗口（侧栏）与全屏视图（独立笔记窗口）。

配置项（建议）
- 基本规则（必备）
  - projectTagPrefix: string（默认 `#项目管理`）
  - tagSeparator: string（默认 `/`）
  - projectTagDepth: number（例如 1=项目 + 1级阶段，默认 2）
  - indexFoldersInclude: string[]（白名单）
  - indexBatchSize: number（默 50）
  - enableBackgroundIndexing: boolean
- Tasks 集成（可选）
  - enableTasksIntegration: boolean（默认当检测到 Tasks 时启用）
  - preferTasksDataWhenAvailable: boolean
- UI
  - maxPreviewTasksPerProject: number（默认 3）
  - panelRefreshDebounceMs: number（默认 300）
- AI / 报表
  - enableAiReports: boolean
  - aiProvider: enum（OpenAI / Custom / None）
  - aiApiKey: secret
  - redactSensitiveTextInAi: boolean
- 隐私与安全
  - 允许用户查看将发送给 AI 的文本摘要并手动编辑后发送。

错误处理、兼容性与边界策略
- Tasks 不存在或不可用：自动使用本地解析器，并提醒用户可以启用 Tasks 增强以获得更高精度。
- Tasks cache 未就绪：等待或定时重试读取 tasksPlugin.getTasks()；在 UI 显示“索引中/等待 Tasks”状态。
- 操作冲突：写文件前读取最新文件并检查变更，必要时提示用户合并；写入操作应尽量原子并用 Obsidian 的 Vault API。
- editTaskLineModal 返回空字符串：如发生歧义（取消或 onCompletion 删除），可通过检查任务是否仍在 tasksPlugin.getTasks()（若可访问）来判断，或弹窗确认用户意图。

测试计划
- 单元测试
  - 解析器正则与各种任务格式（含 dataview、emoji、blockLink、custom status）；
  - 标签/层级到项目/阶段的映射测试；
- 集成测试
  - 在 sample vault（小/中/大）上测试索引时间与内存；
  - 测试增量更新（metadataCache.on('changed') 场景）；
  - Tasks 增强场景：Tasks 存在与否、apiV1 模态与 toggle 的调用行为；
- 手工测试
  - UI 交互与冲突处理（编辑并发、文件重命名等）。

开发阶段与里程碑（建议）
- M0（调研）：确定 tag 规则、样例 vault（1-2 天）；
- M1（PoC 本地解析 + 侧边栏）：实现批量索引、TaskLine 解析、简单项目卡片与任务列表（1-2 周）；
- M2（增量索引与设置页）：实现 metadataCache/vault 事件监听、设置界面（1 周）；
- M3（Tasks 增强）：feature-detect Tasks、优先使用 tasksPlugin.getTasks()、集成 apiV1 的 modal/toggle（1 周）；
- M4（UI 完善与筛选）：树视图、筛选器、分页/滚动、项目文档页（1-2 周）；
- M5（报表/AI 与测试）：导出、AI 周报、全量测试（1-2 周）；
- M6（收尾）：文档、打包、发布（3-4 天）。

交付产物（MVP）
- Obsidian 插件包（manifest.json + 打包后的代码）
- README / 用户文档（如何识别项目、如何设置、Tasks 集成说明）
- 测试用 sample vault 与基本单元测试

下一步工作（你可以选择）
- 我可以基于本文档生成：  
  A) 一个仓库骨架（manifest、main.ts、TaskParser.ts、设置页面与侧栏 PoC）；  
  B) 完整的 M1 PoC 代码（本地解析 + 侧边栏，可运行并演示索引与基本视图）；  
  C) 把开发任务拆为 GitHub Issues 列表（含优先级、估时），便于项目管理。  

注明
- 本文档基于你指定的“独立解析并可选 Tasks 增强”策略，并参考 obsidian-tasks 的源码与 docs（注意：Tasks 官方 APIv1 不支持以程序方式运行 tasks 查询语法；可用增强能力见文中说明）。如果需要我可把本文档转换为项目 README.md、开发计划 Issues、或直接生成 PoC 代码。  
