declare module 'obsidian' {
  // Minimal ambient declarations to allow CI builds without full Obsidian type package.
  // These are intentionally permissive (any) to avoid strict type errors during CI.
  export type App = any;
  export type Plugin = any;
  export type PluginSettingTab = any;
  export type Setting = any;
  export type Notice = any;
  export type MarkdownView = any;
  export type WorkspaceLeaf = any;
  export type TFile = any;
  export type Workspace = any;
  export type ItemView = any;
  export type PluginManifest = any;
  export type Modal = any;
  export default any;
}
