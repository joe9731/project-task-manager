declare module 'obsidian' {
  // Minimal value-level + type-level declarations for Obsidian APIs used in this repo.
  // These are permissive (any) but provide value-level symbols so tsc accepts "new/extends" and runtime usage.

  export class Plugin {
    app: any;
    workspace: any;
    vault: any;
    metadataCache: any;
    manifest: any;
    settings?: any;

    constructor();
    load(): Promise<void> | void;
    onunload(): void;
    loadData(): Promise<any>;
    saveData(data: any): Promise<void>;

    // Common registration helpers used in code
    addSettingTab(tab: any): void;
    registerView(type: string, factory: (leaf: any) => any): void;
    addRibbonIcon(icon: string, title: string, cb: () => void): void;
    addCommand(cmd: { id: string; name: string; callback?: (...args: any[]) => void }): void;
    registerEvent(ev: any): void;
  }

  export class PluginSettingTab {
    app: any;
    plugin: Plugin;
    constructor(app: any, plugin: Plugin);
    display(): void;
  }

  export class Setting {
    constructor(containerEl: any);
    setName(name: string): this;
    setDesc(desc: string): this;
    addToggle(cb: (toggle: any) => void): this;
    addText(cb: (text: any) => void): this;
  }

  export class Notice {
    constructor(message: string, timeout?: number);
  }

  export class MarkdownView {
    file: any;
    getViewType(): string;
  }

  export class WorkspaceLeaf {
    view: any;
    setViewState(state: any, options?: any): void;
  }

  export class ItemView {
    constructor(leaf: WorkspaceLeaf);
    getViewType(): string;
    getViewTitle(): string;
  }

  export type TFile = any;

  // Helpers commonly used in plugin code
  export function addIcon(name: string, svg: string): void;

  // default export (some plugins import default)
  const _default: any;
  export default _default;
}

// Extend HTMLElement with Obsidian helpers used by createEl/empty in the code
declare global {
  interface HTMLElement {
    createEl?(tag?: string, attrs?: any, callback?: (el: HTMLElement) => void): HTMLElement;
    empty?(): void;
    addClass?(name: string): void;
    removeClass?(name: string): void;
  }
}

export {};
