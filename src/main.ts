import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView, WorkspaceLeaf, TFile } from 'obsidian';
import { parseFileContent, TaskLite } from './TaskParser';
import { ProjectTaskView, VIEW_TYPE_PROJECT_TASK } from './SidebarView';
import { ProjectTaskSettings, DEFAULT_SETTINGS } from './Settings';
import { Indexer } from './Indexer';
import { adaptExternalTasks } from './TasksAdapter';

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
  indexer: Indexer | null = null;

  async onload() {
    console.log('project-task-manager loading');
    await this.loadSettings();

    // Add settings tab
    try {
      this.addSettingTab(new SettingsTab(this.app, this));
    } catch (e) {
      console.warn('Unable to add settings tab (running in test environment?)', e);
    }

    // Detect Tasks plugin (optional integration)
    try {
      // feature-detect via plugin API
      // @ts-ignore - plugins may not be typed in test env
      const installed = (this.app as any)?.plugins?.plugins?.['obsidian-tasks'];
      if (installed) {
        this.tasksPlugin = installed;
        console.log('Detected obsidian-tasks plugin.');
        this.enableTasksIntegration = this.settings.enableTasksIntegration && !!this.tasksPlugin;
      }
    } catch (e) {
      console.warn('project-task-manager: error detecting tasks plugin', e);
    }

    // Register view type
    try {
      this.registerView(VIEW_TYPE_PROJECT_TASK, (leaf) => new ProjectTaskView(leaf, this));
    } catch (e) {
      // In some test environments registerView might not exist
      console.warn('registerView not available', e);
    }

    // Add a ribbon icon to toggle the side view (best-effort)
    try {
      this.addRibbonIcon('list-checks', 'Project Task Manager', () => {
        this.activateView();
      });
    } catch (e) {
      // ignore in headless/test
    }

    // Command to open view
    try {
      this.addCommand({
        id: 'open-project-task-view',
        name: 'Open Project Task Manager View',
        callback: () => this.activateView(),
      });
    } catch (e) {
      // ignore
    }

    // Initialize indexer (non-blocking)
    this.indexer = new Indexer(this as any);
    this.indexer.start(this.settings.indexBatchSize ?? 50).catch((e) => console.error('Index init error', e));

    // Register incremental update listeners
    try {
      // metadata changed - file content changed
      this.registerEvent(
        this.app.metadataCache.on('changed', (file) => {
          if (!file) return;
          // debounce handled by indexer or internal guards; schedule handling
          this.handleFileChanged((file as any).path).catch((err) => console.error('handleFileChanged error', err));
        }),
      );

      this.registerEvent(
        this.app.vault.on('rename', (file: TFile, oldPath: string) => {
          if (!file) return;
          this.handleFileChanged(file.path).catch((err) => console.error('handleFileChanged error', err));
          if (this.index.has(oldPath)) {
            this.index.delete(oldPath);
            this.rebuildAggregatedTasks();
            this.emitIndexUpdated();
          }
        }),
      );

      this.registerEvent(
        this.app.vault.on('delete', (file: TFile) => {
          if (!file) return;
          if (this.index.has((file as any).path)) {
            this.index.delete((file as any).path);
            this.rebuildAggregatedTasks();
            this.emitIndexUpdated();
          }
        }),
      );
    } catch (e) {
      // ignore if registerEvent not available in this environment
      console.warn('Event registration may be unavailable in this environment', e);
    }
  }

  onunload() {
    console.log('project-task-manager unloaded');
    if (this.indexer) this.indexer.stop();
    try {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE_PROJECT_TASK);
    } catch (e) {
      // ignore in test env
    }
  }

  async loadSettings() {
    const data = (await this.loadData()) as Partial<ProjectTaskSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {}) as ProjectTaskSettings;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async activateView() {
    try {
      // Reveal or create left leaf (preferred)
      const leaf = this.app.workspace.getLeftLeaf(false) || this.app.workspace.getRightLeaf(false);
      leaf.setViewState({ type: VIEW_TYPE_PROJECT_TASK, active: true }, { activate: true });
    } catch (e) {
      console.warn('activateView failed (running in non-UI environment?)', e);
    }
  }

  // NOTE: Indexer calls these public helpers via any-cast. Keep them available.
  public rebuildAggregatedTasks() {
    const all: TaskLite[] = [];
    for (const tasks of this.index.values()) {
      all.push(...tasks);
    }
    this.aggregatedTasks = all;
  }

  public emitIndexUpdated() {
    try {
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_PROJECT_TASK);
      for (const leaf of leaves) {
        const view = leaf.view as any;
        if (view && typeof view.onIndexUpdated === 'function') view.onIndexUpdated();
      }
    } catch (e) {
      // ignore in headless
    }
  }

  private async handleFileChanged(path: string) {
    if (!path) return;
    try {
      const tfile = this.app.vault.getAbstractFileByPath(path) as TFile | null;
      if (!tfile || (tfile as any).extension !== 'md') {
        if (this.index.has(path)) {
          this.index.delete(path);
          this.rebuildAggregatedTasks();
          this.emitIndexUpdated();
        }
        return;
      }

      const content = await this.app.vault.read(tfile as any);
      const tasks = parseFileContent(content, path);
      this.index.set(path, tasks);
      this.rebuildAggregatedTasks();
      this.emitIndexUpdated();
    } catch (e) {
      console.error('Error handling file changed:', path, e);
    }
  }

  // Utility: expose tasks for view (and for Tasks integration mapping)
  public getAllTasks(): TaskLite[] {
    // If Tasks integration enabled and tasksPlugin provides getTasks(), prefer it optionally.
    if (
      this.enableTasksIntegration &&
      this.tasksPlugin &&
      typeof this.tasksPlugin.getTasks === 'function' &&
      this.settings.preferTasksDataWhenAvailable
    ) {
      try {
        const external = this.tasksPlugin.getTasks();
        if (Array.isArray(external) && external.length > 0) {
          const adapted = adaptExternalTasks(external, 'tasks-plugin');
          if (adapted.length > 0) return adapted;
        }
      } catch (e) {
        console.warn('Error reading tasksPlugin.getTasks()', e);
      }
    }

    return this.aggregatedTasks;
  }

  /**
   * Toggle a task's checkbox status in the underlying file. If checked -> unchecked and vice versa.
   * After modifying the file, reparse and update the index.
   */
  public async toggleTaskStatus(task: TaskLite): Promise<void> {
    if (!task || !task.filePath) return;
    try {
      const tfile = this.app.vault.getAbstractFileByPath(task.filePath) as TFile | null;
      let content: string;
      if (tfile) content = await this.app.vault.read(tfile as any);
      else content = await this.app.vault.read(task.filePath as any);

      const lines = content.split(/\r?\n/);
      const lineIdx = Math.max(0, (task.lineNumber || 1) - 1);
      if (lineIdx >= lines.length) return;

      const line = lines[lineIdx];
      // Replace checkbox char inside [ ]
      const replaced = line.replace(/(\[)\s*([ xX\-\/\+\?])\s*(\])/, (m, a, s, c) => {
        const cur = (s || ' ').trim().toLowerCase();
        let next = 'x';
        if (cur === 'x') next = ' ';
        return `${a}${next}${c}`;
      });

      if (replaced === line) {
        // If no match, try to inject checkbox
        lines[lineIdx] = `- [x] ${line}`;
      } else {
        lines[lineIdx] = replaced;
      }

      const newContent = lines.join('\n');
      if (tfile) await this.app.vault.modify(tfile as any, newContent);
      else await this.app.vault.modify({ path: task.filePath } as any, newContent);

      // Re-parse the file and update index
      const newTasks = parseFileContent(newContent, task.filePath);
      this.index.set(task.filePath, newTasks);
      this.rebuildAggregatedTasks();
      this.emitIndexUpdated();
    } catch (e) {
      console.error('toggleTaskStatus error', e);
    }
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
    try {
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

      new Setting(containerEl)
        .setName('Index batch size')
        .setDesc('Number of files processed per indexing batch (performance tuning)')
        .addText((text) => text.setValue(String(this.plugin.settings.indexBatchSize)).onChange(async (v) => {
          const n = Number(v) || DEFAULT_SETTINGS.indexBatchSize;
          this.plugin.settings.indexBatchSize = n;
          await this.plugin.saveSettings();
        }));
    } catch (e) {
      // display may fail in headless/test environment
      console.warn('SettingsTab.display failed', e);
    }
  }
}
