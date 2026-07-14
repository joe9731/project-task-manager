import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { parseFileContent, TaskLite } from './TaskParser';
import { ProjectTaskView, VIEW_TYPE_PROJECT_TASK } from './SidebarView';
import { ProjectTaskSettings, DEFAULT_SETTINGS } from './Settings';

/**
 * ProjectTaskManager - main plugin class
 *
 * Strategy: independent parsing + optional Tasks integration (feature-detect)
 */
export default class ProjectTaskManager extends Plugin {
    settings: ProjectTaskSettings;
    index: Map<string, TaskLite[]> = new Map(); // filePath -> tasks
    aggregatedTasks: TaskLite[] = []; // flat list cached
    viewLeaf: WorkspaceLeaf | null = null;
    tasksPlugin: any = null;
    enableTasksIntegration: boolean = false;

    async onload() {
        console.log('project-task-manager loading');
        await this.loadSettings();

        this.addSettingTab(new SettingsTab(this.app, this));

        // Detect Tasks plugin (optional integration)
        // Feature-detect only; don't require it.
        try {
            // @ts-ignore
            const installed = (this.app as any).plugins?.plugins?.['obsidian-tasks'];
            if (installed) {
                this.tasksPlugin = installed;
                console.log('Detected obsidian-tasks plugin.');
                // default: enable integration only if setting true
                this.enableTasksIntegration = this.settings.enableTasksIntegration && !!this.tasksPlugin;
            }
        } catch (e) {
            console.warn('project-task-manager: error detecting tasks plugin', e);
        }

        // Register view type
        this.registerView(
            VIEW_TYPE_PROJECT_TASK,
            (leaf) => new ProjectTaskView(leaf, this),
        );

        // Add a ribbon icon to toggle the side view
        this.addRibbonIcon('list-checks', 'Project Task Manager', () => {
            this.activateView();
        });

        // Command to open view
        this.addCommand({
            id: 'open-project-task-view',
            name: 'Open Project Task Manager View',
            callback: () => this.activateView(),
        });

        // Initialize index (non-blocking)
        this.initializeIndexer().catch((e) => console.error('Index init error', e));
    }

    onunload() {
        console.log('project-task-manager unloaded');
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_PROJECT_TASK);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as ProjectTaskSettings;
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private async activateView() {
        // Reveal or create left leaf (user preference: default left side)
        this.app.workspace.getLeftLeaf(false).setViewState({
            type: VIEW_TYPE_PROJECT_TASK,
            active: true,
        }, { activate: true });
    }

    /**
     * Initialize index: batch-scan vault markdown files and parse tasks.
     */
    async initializeIndexer(): Promise<void> {
        const mdFiles = this.app.vault.getMarkdownFiles();
        const batchSize = Math.max(20, this.settings.indexBatchSize ?? 50);

        for (let i = 0; i < mdFiles.length; i += batchSize) {
            const batch = mdFiles.slice(i, i + batchSize);
            await Promise.all(batch.map(async (file) => {
                try {
                    const content = await this.app.vault.read(file);
                    const tasks = parseFileContent(content, file.path);
                    this.index.set(file.path, tasks);
                } catch (e) {
                    console.error('Error reading file', file.path, e);
                }
            }));

            // yield to UI thread
            await new Promise((r) => setTimeout(r, 10));
        }

        this.rebuildAggregatedTasks();
        this.emitIndexUpdated();

        // subscribe to incremental updates
        this.registerEvent(this.app.metadataCache.on('changed', (file) => {
            if (!file) return;
            this.handleFileChanged(file.path).catch(console.error);
        }));

        this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
            if (!file) return;
            // reindex renamed file path
            this.handleFileChanged(file.path).catch(console.error);
            // remove old mapping if present
            if (this.index.has(oldPath)) {
                const v = this.index.get(oldPath);
                this.index.delete(oldPath);
                // NOTE: we don't currently remap tasks id; rebuild aggregated
                this.rebuildAggregatedTasks();
                this.emitIndexUpdated();
            }
        }));

        this.registerEvent(this.app.vault.on('delete', (file) => {
            if (!file) return;
            if (this.index.has(file.path)) {
                this.index.delete(file.path);
                this.rebuildAggregatedTasks();
                this.emitIndexUpdated();
            }
        }));
    }

    private async handleFileChanged(path: string) {
        const tfile = this.app.vault.getAbstractFileByPath(path);
        if (!tfile || (tfile as any).extension !== 'md') {
            if (this.index.has(path)) {
                this.index.delete(path);
                this.rebuildAggregatedTasks();
                this.emitIndexUpdated();
            }
            return;
        }
        try {
            const content = await this.app.vault.read(tfile as any);
            const tasks = parseFileContent(content, path);
            this.index.set(path, tasks);
            this.rebuildAggregatedTasks();
            this.emitIndexUpdated();
        } catch (e) {
            console.error('Error re-reading changed file', path, e);
        }
    }

    private rebuildAggregatedTasks() {
        const all: TaskLite[] = [];
        for (const tasks of this.index.values()) {
            all.push(...tasks);
        }
        this.aggregatedTasks = all;
    }

    private emitIndexUpdated() {
        // Notify view to re-render if open
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_PROJECT_TASK);
        for (const leaf of leaves) {
            const view = leaf.view as ProjectTaskView;
            if (view && typeof view.onIndexUpdated === 'function') {
                view.onIndexUpdated();
            }
        }
    }

    // Utility: expose tasks for view (and for Tasks integration mapping)
    public getAllTasks(): TaskLite[] {
        // If Tasks integration enabled and tasksPlugin provides getTasks(), prefer it optionally.
        if (this.enableTasksIntegration && this.tasksPlugin && typeof this.tasksPlugin.getTasks === 'function' && this.settings.preferTasksDataWhenAvailable) {
            try {
                const external = this.tasksPlugin.getTasks();
                if (Array.isArray(external) && external.length > 0) {
                    // NOTE: conversion adapter needed here in real implementation.
                    // For now we fallback to our own aggregatedTasks if conversion not implemented.
                    // TODO: map external Task -> TaskLite
                    console.log('Using tasksPlugin.getTasks() as source (adapter not implemented yet)');
                }
            } catch (e) {
                console.warn('Error reading tasksPlugin.getTasks()', e);
            }
        }
        return this.aggregatedTasks;
    }
}

/**
 * Basic SettingsTab skeleton (delegates to plugin.settings)
 */
class SettingsTab extends PluginSettingTab {
    plugin: ProjectTaskManager;

    constructor(app: App, plugin: ProjectTaskManager) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Project Task Manager Settings' });

        new Setting(containerEl)
            .setName('Enable Tasks integration (if installed)')
            .setDesc('When enabled and obsidian-tasks is installed, the plugin can use Tasks parsed data for higher fidelity.')
            .addToggle((t) => t.setValue(this.plugin.settings.enableTasksIntegration).onChange(async (v) => {
                this.plugin.settings.enableTasksIntegration = v;
                await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
            .setName('Prefer Tasks data when available')
            .setDesc('If enabled, and obsidian-tasks is present, prefer Tasks plugin data over local parsing where feasible.')
            .addToggle((t) => t.setValue(this.plugin.settings.preferTasksDataWhenAvailable).onChange(async (v) => {
                this.plugin.settings.preferTasksDataWhenAvailable = v;
                await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
            .setName('Project tag prefix')
            .setDesc('Default tag prefix used to identify projects, e.g. #项目管理')
            .addText((text) => text.setValue(this.plugin.settings.projectTagPrefix).onChange(async (v) => {
                this.plugin.settings.projectTagPrefix = v.trim();
                await this.plugin.saveSettings();
            }));
    }
}
