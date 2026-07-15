// Minimal Obsidian typings focused on the APIs used in this project.
// These are more precise than the previous permissive file but still lightweight.

declare module 'obsidian' {
  export interface TFile {
    path: string;
    name: string;
    extension?: string;
  }

  export interface Vault {
    read(file: TFile | string): Promise<string>;
    modify(file: TFile | { path: string } | string, data: string): Promise<void>;
    getMarkdownFiles(): TFile[];
    getAbstractFileByPath(path: string): TFile | null;
    on(event: string, cb: (...args: any[]) => void): void;
  }

  export interface MetadataCache {
    on(event: string, cb: (...args: any[]) => void): void;
  }

  export interface WorkspaceLeaf {
    view: any;
    setViewState(state: any, options?: any): void;
  }

  export interface Workspace {
    getLeftLeaf(fallback?: boolean): WorkspaceLeaf;
    getRightLeaf(fallback?: boolean): WorkspaceLeaf;
    getLeavesOfType(type: string): WorkspaceLeaf[];
    detachLeavesOfType(type: string): void;
    openFile(file: TFile, opts?: any): Promise<void>;
    getActiveViewOfType<T>(ctor: any): any;
  }

  export interface App {
    vault: Vault;
    workspace: Workspace;
    metadataCache: MetadataCache;
    plugins?: any;
  }

  export class Plugin {
    app: App;
    manifest: any;
    loadData(): Promise<any>;
    saveData(data: any): Promise<void>;
    addSettingTab(tab: any): void;
    registerView(type: string, factory: (leaf: WorkspaceLeaf) => any): void;
    addRibbonIcon(icon: string, title: string, cb: () => void): void;
    addCommand(cmd: any): void;
    registerEvent(ev: any): void;
  }

  export class PluginSettingTab {
    app: App;
    plugin: Plugin;
    constructor(app: App, plugin: Plugin);
    display(): void;
  }

  export class Setting {
    constructor(containerEl: HTMLElement);
    setName(name: string): this;
    setDesc(desc: string): this;
    addToggle(cb: (t: any) => void): this;
    addText(cb: (t: any) => void): this;
  }

  export class MarkdownView {
    editor?: any;
    file?: TFile;
  }

  export default {} as any;
}

// Minimal HTMLElement extensions used by Obsidian helper methods
declare global {
  interface HTMLElement {
    createEl?(tag?: string, attr?: any, cb?: (el: HTMLElement) => void): HTMLElement;
    empty?(): void;
    addClass?(name: string): void;
    removeClass?(name: string): void;
  }
}

export {};
