export interface ProjectTaskSettings {
    enableTasksIntegration: boolean;
    preferTasksDataWhenAvailable: boolean;
    projectTagPrefix: string;
    indexBatchSize: number;
}

export const DEFAULT_SETTINGS: ProjectTaskSettings = {
    enableTasksIntegration: true,
    preferTasksDataWhenAvailable: false,
    projectTagPrefix: '#项目管理',
    indexBatchSize: 50,
};
