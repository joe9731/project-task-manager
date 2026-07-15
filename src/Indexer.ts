import { TaskLite, parseFileContent } from './TaskParser';

export class Indexer {
  plugin: any;
  isRunning: boolean = false;
  cancelled: boolean = false;
  progress: { processed: number; total: number } = { processed: 0, total: 0 };

  constructor(plugin: any) {
    this.plugin = plugin;
  }

  async start(batchSize: number = 50) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.cancelled = false;

    try {
      const mdFiles = this.plugin.app.vault.getMarkdownFiles();
      this.progress.total = mdFiles.length;
      this.progress.processed = 0;

      for (let i = 0; i < mdFiles.length; i += batchSize) {
        if (this.cancelled) break;
        const batch = mdFiles.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (file: any) => {
            try {
              const content = await this.plugin.app.vault.read(file);
              const tasks: TaskLite[] = parseFileContent(content, file.path);
              this.plugin.index.set(file.path, tasks);
            } catch (e) {
              console.error('Indexer: error reading/parsing', file.path, e);
            } finally {
              this.progress.processed += 1;
            }
          }),
        );

        // yield to UI thread briefly
        await new Promise((r) => setTimeout(r, 10));
      }

      // Rebuild aggregated tasks and notify view. Use plugin's methods if available.
      try {
        if (typeof (this.plugin as any).rebuildAggregatedTasks === 'function') {
          (this.plugin as any).rebuildAggregatedTasks();
        }
        if (typeof (this.plugin as any).emitIndexUpdated === 'function') {
          (this.plugin as any).emitIndexUpdated();
        }
      } catch (e) {
        console.error('Indexer: error calling plugin callbacks', e);
      }
    } finally {
      this.isRunning = false;
    }
  }

  stop() {
    this.cancelled = true;
  }
}
