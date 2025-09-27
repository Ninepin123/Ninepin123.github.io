class ProjectManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    getProjectData() {
        const state = this.stateManager.getState();
        return {
            name: state.currentProjectName,
            createdAt: new Date().toISOString(),
            version: "1.0",
            particles: state.particlePoints.map(point => ({
                x: point.x,
                y: point.y,
                z: point.z,
                particleType: point.particleType,
                color: point.color
            })),
            settings: {
                drawingHeight: state.drawingHeight,
                planeRotation: state.planeRotation,
                particleType: state.particleType,
                particleColor: state.particleColor,
                cameraSensitivity: state.cameraSensitivity,
                redstonePalette: state.redstonePalette,
                activePaletteIndex: state.activePaletteIndex
            }
        };
    }

    newProject() {
        if (this.stateManager.getState().hasUnsavedChanges) {
            if (!confirm('目前專案有未儲存的變更，確定要建立新專案嗎？')) {
                return;
            }
        }
        this.stateManager.loadProject({ name: '未命名專案' });
    }

    saveProject() {
        const state = this.stateManager.getState();
        const projectName = state.currentProjectName.trim() || '未命名專案';

        // 更新 state 中的專案名稱以防萬一
        if(state.currentProjectName !== projectName) {
            this.stateManager.setProjectName(projectName);
        }

        const projectData = this.getProjectData();
        const dataStr = JSON.stringify(projectData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${projectName}.mythic3d`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.stateManager.setUnsavedChanges(false);
        console.log(`專案 "${projectName}" 已儲存`);
    }

    loadProject() {
        if (this.stateManager.getState().hasUnsavedChanges) {
            if (!confirm('目前專案有未儲存的變更，確定要載入新專案嗎？')) {
                return;
            }
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.mythic3d,.json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const projectData = JSON.parse(e.target.result);
                    this.stateManager.loadProject(projectData);
                    console.log(`專案 "${projectData.name}" 載入成功！`);
                } catch (error) {
                    console.error('解析專案檔案時發生錯誤:', error);
                    alert('無法讀取專案檔案，請確認檔案格式是否正確。');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
}

export default ProjectManager;