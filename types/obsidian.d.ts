declare module 'obsidian' {
  // Minimal permissive value-level and type-level exports to satisfy imports used in the codebase.
  // These are intentionally permissive (any) to allow CI builds; replace with real types later.
  export const App: any;
  export const Plugin: any;
  export const PluginSettingTab: any;
  export const Setting: any;
  export const Notice: any;
  export const MarkdownView: any;
  export const WorkspaceLeaf: any;
  export const TFile: any;
  export const Workspace: any;
  export const ItemView: any;
  export const Modal: any;
  export const View: any;
  export const SettingConstructor: any;

  // default export for CommonJS-style imports
  const _default: any;
  export default _default;
}

// Extend global HTMLElement with Obsidian helper methods used in the code (createEl, empty, etc.)
declare global {
  interface HTMLElement {
    createEl?: any;
    empty?: any;
    addClass?: any;
    removeClass?: any;
  }
}

export {};
