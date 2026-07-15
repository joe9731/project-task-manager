import { ItemView, WorkspaceLeaf, MarkdownView, TFile } from 'obsidian';
import type ProjectTaskManager from './main';
import { TaskLite } from './TaskParser';

export const VIEW_TYPE_PROJECT_TASK = 'project-task-manager-view';

type ProjectMap = Map<string, TaskLite[]>;

export class ProjectTaskView extends ItemView {
    plugin: ProjectTaskManager;
    containerEl: HTMLElement;
    selectedProject: string | null = null;
    expandedTasks: Set<string> = new Set(); // task.id -> expanded (for future sub-tasks)

    constructor(leaf: WorkspaceLeaf, plugin: ProjectTaskManager) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_PROJECT_TASK;
    }

    getDisplayText() {
        return 'Project Task Manager';
    }

    async onOpen() {
        // Correctly reference the view's content element
        this.containerEl = this.contentEl;
        this.render();
    }

    async onClose() {
        // cleanup if needed
    }

    onIndexUpdated() {
        // called by plugin when index rebuild occurs
        this.render();
    }

    private groupTasksByProject(tasks: TaskLite[]): ProjectMap {
        const map: ProjectMap = new Map();
        for (const t of tasks) {
            // Prefer project identified by first tag that includes projectTagPrefix
            let key = '(no tag)';
            if (t.tags && t.tags.length > 0) {
                // try to find a tag that starts with configured project prefix
                const prefix = this.plugin.settings.projectTagPrefix || '#项目管理';
                const matched = t.tags.find((tg) => tg.startsWith(prefix));
                if (matched) {
                    // use first segment after prefix if present
                    key = matched;
                } else {
                    key = t.tags[0] || '(no tag)';
                }
            }
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(t);
        }
        return map;
    }

    render() {
        this.containerEl.empty();

        const header = this.containerEl.createEl('div', { cls: 'ptm-header' });
        header.createEl('h3', { text: 'Project Task Manager' });

        // Simple summary
        const tasks = this.plugin.getAllTasks();
        const total = tasks.length;
        header.createEl('div', { text: `Indexed tasks: ${total}` });

        // Dashboard placeholder
        const dash = this.containerEl.createEl('div', { cls: 'ptm-dashboard' });
        dash.createEl('strong', { text: 'Dashboard' });
        const projectSet = new Set<string>();
        for (const t of tasks) {
            if (t.tags && t.tags.length > 0) projectSet.add(t.tags[0]);
        }
        dash.createEl('div', { text: `Projects detected: ${projectSet.size}` });

        // Projects list (cards)
        const projectsDiv = this.containerEl.createEl('div', { cls: 'ptm-projects' });
        projectsDiv.createEl('h4', { text: 'Projects' });

        const projectMap = this.groupTasksByProject(tasks);

        // Project selector (dropdown)
        const selector = this.containerEl.createEl('select', { cls: 'ptm-project-selector' }) as HTMLSelectElement;
        const allOption = document.createElement('option');
        allOption.text = '(all projects)';
        allOption.value = '(all)';
        selector.appendChild(allOption);
        for (const key of projectMap.keys()) {
            const opt = document.createElement('option');
            opt.text = key;
            opt.value = key;
            selector.appendChild(opt);
        }
        selector.onchange = (e) => {
            const val = (e.target as HTMLSelectElement).value;
            this.selectedProject = val === '(all)' ? null : val;
            this.render();
        };

        // Cards area (show up to 3 projects)
        let shown = 0;
        for (const [project, list] of projectMap.entries()) {
            if (shown >= 3) break;
            const card = projectsDiv.createEl('div', { cls: 'ptm-project-card' });
            const title = card.createEl('div', { cls: 'ptm-project-title' });
            title.createEl('strong', { text: project });
            title.createEl('span', { text: ` — ${list.length} tasks`, cls: 'ptm-project-count' });

            // sample tasks
            const sample = card.createEl('div', { cls: 'ptm-project-sample' });
            for (let i = 0; i < Math.min(3, list.length); i++) {
                const t = list[i];
                sample.createEl('div', { text: `• ${t.description}` });
            }

            // Click handler to select project
            card.onclick = () => {
                this.selectedProject = project;
                // re-render to show project details below
                this.render();
            };

            shown++;
        }

        // If more projects, show mini summary
        if (projectMap.size > 3) {
            const more = projectsDiv.createEl('div', { text: `...and more (${projectMap.size - 3})` });
        }

        // If a project is selected or selector, show task tree
        const projectToShow = this.selectedProject ? this.selectedProject : null;
        if (projectToShow) {
            const tasksList = projectMap.get(projectToShow) || [];
            const treeRoot = this.containerEl.createEl('div', { cls: 'ptm-task-tree' });
            treeRoot.createEl('h4', { text: `Tasks for ${projectToShow}` });
            this.renderTaskTree(treeRoot, tasksList);
        } else if (this.selectedProject === null && projectMap.size > 0) {
            // show combined tree for all projects (limited)
            const treeRoot = this.containerEl.createEl('div', { cls: 'ptm-task-tree' });
            treeRoot.createEl('h4', { text: `All Projects` });
            // flatten to a few items
            const sampleTasks = tasks.slice(0, 50);
            this.renderTaskTree(treeRoot, sampleTasks);
        }
    }

    private renderTaskTree(container: HTMLElement, tasks: TaskLite[]) {
        // Build a simple tree based on indentation fallback
        // For PoC we just list tasks grouped by top-level tag or file
        const groupByFile = new Map<string, TaskLite[]>();
        for (const t of tasks) {
            const key = t.filePath || '(unknown)';
            if (!groupByFile.has(key)) groupByFile.set(key, []);
            groupByFile.get(key).push(t);
        }

        for (const [filePath, list] of groupByFile.entries()) {
            const fileDiv = container.createEl('div', { cls: 'ptm-task-file' });
            const fileTitle = fileDiv.createEl('div', { text: filePath, cls: 'ptm-task-file-title' });
            const ul = fileDiv.createEl('div', { cls: 'ptm-task-list' });
            for (const t of list) {
                const item = ul.createEl('div', { cls: 'ptm-task-item' });
                const statusEl = item.createEl('span', { text: t.statusSymbol === ' ' ? '[ ]' : `[${t.statusSymbol}]`, cls: 'ptm-task-status' });
                statusEl.onclick = async (e) => {
                    e.preventDefault();
                    try {
                        await this.plugin.toggleTaskStatus(t);
                    } catch (err) {
                        console.error('toggleTaskStatus failed', err);
                    }
                };
                const desc = item.createEl('a', { text: t.description, cls: 'ptm-task-desc' });
                desc.onclick = async (e) => {
                    e.preventDefault();
                    await this.openFileAtLine(t);
                };
                // show tags
                if (t.tags && t.tags.length > 0) {
                    const tagsEl = item.createEl('span', { text: ` ${t.tags.join(' ')}`, cls: 'ptm-task-tags' });
                }
            }
        }
    }

    private async openFileAtLine(task: TaskLite) {
        try {
            const file = this.plugin.app.vault.getAbstractFileByPath(task.filePath) as TFile;
            if (!file) {
                console.warn('openFileAtLine: file not found', task.filePath);
                return;
            }
            await this.plugin.app.workspace.openFile(file, { active: true });

            // Try to move cursor to line if a MarkdownView is active
            const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
            if (view && (view as any).editor) {
                (view as any).editor.setCursor({ line: Math.max(0, task.lineNumber - 1), ch: 0 });
                (view as any).editor.focus();
                // scroll to cursor
                (view as any).editor.scrollIntoView({ line: task.lineNumber - 1, ch: 0 });
            }
        } catch (e) {
            console.error('openFileAtLine error', e);
        }
    }
}
