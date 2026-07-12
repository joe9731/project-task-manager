# project-task-manager (开发文档 & 插件骨架)

临时插件名：project-task-manager  
策略：主体采用独立解析与索引（遍历 vault，正则识别任务），在设置里提供“如果仓库安装了 Tasks，则启用增强集成”选项（Tasks 增强为可选）。

本仓库包含插件骨架 (A)：manifest、package.json、src 主文件、任务解析器、设置 tab、侧边栏视图 skeleton。

下一步（B）计划：实现 M1 PoC（本地解析 + 侧边栏显示项目卡片与任务树，含增量索引与基础交互）。

如何使用（本地测试）
1. 将本项目拷贝到 Obsidian 社区插件开发目录（或使用插件样板流程）。  
2. 安装依赖并构建（视具体 build 配置，若使用 rollup/webpack/snowpack，请按配置执行）。  
3. 在 Obsidian 中以开发者模式安装并启用该插件，打开右侧面板查看侧边栏（或使用命令面板打开视图）。

下一步我将基于这个骨架实现 B（M1 PoC）：包含：
- 完整的批量索引（分批）与 parse 流程；
- 侧边栏渲染：dashboard、项目卡片、项目选择、任务树（展开/折叠）；
- 增量更新订阅（metadataCache.on('changed') / vault.on events）；
- 单元测试示例与 sample vault 数据。

你确认我现在开始实现 B 吗？或者希望先把这些文件 push 到某个 GitHub 仓库（请提供 repo owner/name）？
