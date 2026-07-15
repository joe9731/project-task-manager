# project-task-manager (开发文档 & 插件骨架)

临时插件名：project-task-manager  
策略：主体采用独立解析与索引（遍历 vault，正则识别任务），在设置里提供“如果仓库安装了 Tasks，则启用增强集成”选项（Tasks 增强为可选）。

本仓库包含插件骨架 (A)：manifest、package.json、README、src 主文件、任务解析器、设置 tab、侧边栏视图 skeleton。

已实现（截至当前分支 feature/m1-poc）
- 解析器增强（支持多种任务行格式、中文自然语言日期解析、emoji/inline 字段）
- samples/ 示例笔记
- 批量异步索引器（Indexer）并接入插件 onload
- 侧栏 UI（左侧）：Dashboard、项目卡片、项目选择器、任务树、点击任务跳转并定位到源文件行
- 增量更新：已接入 metadataCache.on('changed') 以及 vault rename/delete 事件（保持索引同步）
- 简易解析器单元测试（scripts/run-parser-tests.ts），可通过 `npm test` 运行（需要先 npm install）

下一步（我将在分支上继续）
- 在分支完成全部 M1 内容后创建 PR（会在 PR 创建时通知你）

本地运行 / 测试（程序员小白友好）
1. 克隆仓库并切换到分支：
   - git clone https://github.com/joe9731/project-task-manager.git
   - cd project-task-manager
   - git checkout feature/m1-poc
2. 安装依赖并运行简单测试：
   - npm install
   - npm test   # 运行脚本化的解析器单元测试示例
3. 在 Obsidian 中加载插件（开发模式）：
   - 在你的 Vault 下创建目录 .obsidian/plugins/project-task-manager（若不存在）
   - 运行 `npm run build` 将 TypeScript 编译为 JavaScript（生成 main.js）并把必要文件复制到插件目录（或我会在 PR 中附带构建产物）
   - 在 Obsidian 打开“设置 → 社区插件”，启用并加载该插件，然后打开左侧的 Project Task Manager 视图。

如需我在分支中包含已构建的 main.js 以方便你直接复制到 Vault，请在 PR 前告诉我，我可以把构建产物一并推到分支（仅在你确认允许放置构建产物时才推）。
