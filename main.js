module.exports = class ProjectTaskManagerBuild extends window.obsidian.Plugin {
  async onload() {
    console.log('project-task-manager: build main.js loaded (minimal stub).');
    try {
      this.addRibbonIcon('list-checks','Project Task Manager (stub)', ()=>{
        // Try to open the left view if registered by the TS source; otherwise just notify.
        try {
          this.app.workspace.getLeftLeaf(false).setViewState({ type: 'project-task-manager-view', active: true }, { activate: true });
        } catch (e) {
          new window.obsidian.Notice('Project Task Manager: view not available in build stub.');
        }
      });
    } catch (e) {
      console.warn('Ribbon icon may not be available in this environment', e);
    }
  }

  onunload() {
    console.log('project-task-manager: build stub unloaded');
  }
};
