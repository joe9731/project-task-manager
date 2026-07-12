import { ItemView, WorkspaceLeaf } from 'obsidian';
import type ProjectTaskManager from './main';
import { TaskLite } from './TaskParser';

export const VIEW_TYPE_PROJECT_TASK = 'project-task-manager-view';

export class ProjectTaskView extends ItemView {
    plugin: ProjectTaskManager;
    containerEl: HTMLElement;

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
        this.containerEl = this.containerEl; // for typing
        this.render();
    }

    async onClose() {
        // cleanup if needed
    }

    onIndexUpdated() {
        // called by plugin when index rebuild occurs
        this.render();
    }

    render() {
        this.containerEl.empty();
        const header = this.containerEl.createEl('div', { cls: 'ptm-header' });
        header.createEl('h3', { text: 'Project Task Manager' });

        // Simple summary
        const tasks = this.plugin.getAllTasks();
        const total = tasks.length;
        header.createEl('div', { text: `Indexed tasks: ${total}` });

        // Show top 3 projects (PoC placeholder)
        const projectsDiv = this.containerEl.createEl('div', { cls: 'ptm-projects' });
        projectsDiv.createEl('h4', { text: 'Projects (sample)' });

        // For PoC, group by first tag (if present)
        const map = new Map<string, TaskLite[]>();
        for (const t of tasks) {
            const key = t.tags && t.tags.length > 0 ? t.tags[0] : '(no tag)';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(t);
        }

        let shown = 0;
        for (const [project, list] of map.entries()) {
            if (shown >= 3) {
                // show mini scroller summary
                const more = projectsDiv.createEl('div', { text: `...and more (${map.size - 3})` });
                break;
            }
            const card = projectsDiv.createEl('div', { cls: 'ptm-project-card' });
            card.createEl('strong', { text: project });
            card.createEl('div', { text: `Tasks: ${list.length}` });
            // show up to 3 task descriptions
            for (let i = 0; i < Math.min(3, list.length); i++) {
                card.createEl('div', { text: `• ${list[i].description}` });
            }
            shown++;
        }
    }
}
