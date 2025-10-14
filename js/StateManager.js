class StateManager {
    constructor() {
        this.particlePoints = [];
        this.drawingGroups = []; // 新增：儲存繪圖群組
        this.currentMode = 'camera'; // 'camera', 'select', 'point', 'brush', 'eraser', 'rectangle', 'circle'
        this.eraserMode = 'point'; // 新增：橡皮擦模式 'point' 或 'group'
        this.shapeFillMode = 'filled'; // 新增：圖形填充模式 'filled' 或 'outline'
        this.drawingHeight = 0;
        this.planeRotation = { x: 0, y: 0, z: 0 };
        this.cameraSensitivity = 1.0;
        this.particleType = 'flame';
        this.particleColor = '#ff0000';
        this.isDrawing = false;
        this.lastPointPosition = null;
        this.hasUnsavedChanges = false;
        this.currentProjectName = '未命名專案';
        this.skillId = 'MyDrawingSkill'; // 新增：技能 ID
        this.gridSize = 10; // 新增：網格大小
        this.selectedGroup = null; // 新增：當前選中的群組


        // 監聽器
        this.listeners = [];
    }

    // --- 訂閱/發布模式，用於狀態變更通知 ---
    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.getState()));
    }

    // --- 狀態獲取 ---
    getState() {
        return {
            particlePoints: this.particlePoints,
            drawingGroups: this.drawingGroups,
            currentMode: this.currentMode,
            eraserMode: this.eraserMode,
            shapeFillMode: this.shapeFillMode,
            drawingHeight: this.drawingHeight,
            planeRotation: this.planeRotation,
            cameraSensitivity: this.cameraSensitivity,
            particleType: this.particleType,
            particleColor: this.particleColor,
            isDrawing: this.isDrawing,
            lastPointPosition: this.lastPointPosition,
            hasUnsavedChanges: this.hasUnsavedChanges,
            currentProjectName: this.currentProjectName,
            skillId: this.skillId,
            gridSize: this.gridSize,
            selectedGroup: this.selectedGroup,
            usedColors: this.getUsedColors(),
        };
    }

    // --- 取得已使用的顏色列表 ---
    getUsedColors() {
        const colors = new Set();
        // 舊系統：獨立粒子點
        this.particlePoints.forEach(point => {
            if (point.particleType === 'reddust' && point.color) {
                colors.add(point.color);
            }
        });
        // 新系統：繪圖群組（從群組與其粒子收集顏色）
        this.drawingGroups.forEach(group => {
            if (group.color) colors.add(group.color);
            if (Array.isArray(group.particles)) {
                group.particles.forEach(p => {
                    if (p && p.particleType === 'reddust' && p.color) {
                        colors.add(p.color);
                    }
                });
            }
        });
        return Array.from(colors).sort();
    }

    // --- 狀態修改 ---
    setMode(mode) {
        this.currentMode = mode;
        this.notify();
    }

    setEraserMode(mode) {
        this.eraserMode = mode;
        this.notify();
    }

    setShapeFillMode(mode) {
        this.shapeFillMode = mode;
        this.notify();
    }

    setDrawing(isDrawing) {
        this.isDrawing = isDrawing;
        this.notify();
    }

    setLastPointPosition(position) {
        this.lastPointPosition = position;
        // We don't notify here, as this is an internal state for the brush stroke
    }

    setDrawingHeight(height) {
        this.drawingHeight = height;
        this.notify();
    }

    setPlaneRotation(rotation) {
        this.planeRotation = rotation;
        this.notify();
    }

    setCameraSensitivity(sensitivity) {
        this.cameraSensitivity = sensitivity;
        this.notify();
    }

    setParticleSettings(type, color) {
        console.log(`[StateManager] setParticleSettings 被調用: type=${type}, color=${color}`);
        console.log(`[StateManager] 修改前: particleType=${this.particleType}, particleColor=${this.particleColor}`);
        
        this.particleType = type;
        this.particleColor = color;
        
        
        console.log(`[StateManager] 修改後: particleType=${this.particleType}, particleColor=${this.particleColor}`);
        console.log(`[StateManager] 即將調用 notify()`);
        
        // 變更粒子設定屬於專案變更，標記需儲存
        this.setUnsavedChanges(true);

        this.notify();
        
        console.log(`[StateManager] notify() 已完成`);
    }
    

    setProjectName(name) {
        this.currentProjectName = name;
        this.setUnsavedChanges(true);
        this.notify();
    }

    setSkillId(skillId) {
        this.skillId = skillId;
        this.setUnsavedChanges(true);
        this.notify();
    }

    setGridSize(size) {
        this.gridSize = size;
        this.setUnsavedChanges(true);
        this.notify();
    }

    setSelectedGroup(group) {
        this.selectedGroup = group;
        this.notify();
    }

    setUnsavedChanges(status) {
        this.hasUnsavedChanges = status;
        this.notify();
    }

    addPoint(pointData) {
        this.particlePoints.push(pointData);
        this.setUnsavedChanges(true);
        this.notify();
    }

    undoLastPoint() {
        // 優先撤銷最後添加的群組，如果沒有群組則撤銷獨立粒子點
        if (this.drawingGroups.length > 0) {
            const lastGroup = this.drawingGroups.pop();
            if (lastGroup) {
                this.setUnsavedChanges(true);
            }
            this.notify();
            return lastGroup;
        } else if (this.particlePoints.length > 0) {
            const lastPoint = this.particlePoints.pop();
            if (lastPoint) {
                this.setUnsavedChanges(true);
            }
            this.notify();
            return lastPoint;
        }
        this.notify();
        return null;
    }

    removePoints(pointsToRemove) {
        const idsToRemove = new Set(pointsToRemove.map(p => p.id));
        this.particlePoints = this.particlePoints.filter(p => !idsToRemove.has(p.id));
        if (pointsToRemove.length > 0) {
            this.setUnsavedChanges(true);
        }
        this.notify();
    }

    clearPoints() {
        const hadPoints = this.particlePoints.length > 0;
        const hadGroups = this.drawingGroups.length > 0;
        this.particlePoints = [];
        this.drawingGroups = [];
        this.selectedGroup = null;
        if (hadPoints || hadGroups) {
            this.setUnsavedChanges(true);
        }
        this.notify();
    }

    addGroup(groupData) {
        this.drawingGroups.push(groupData);
        this.setUnsavedChanges(true);
        this.notify();
    }

    removeGroup(groupId) {
        const index = this.drawingGroups.findIndex(g => g.id === groupId);
        if (index !== -1) {
            this.drawingGroups.splice(index, 1);
            if (this.selectedGroup && this.selectedGroup.id === groupId) {
                this.selectedGroup = null;
            }
            this.setUnsavedChanges(true);
            this.notify();
        }
    }

    updateGroup(groupId, updates) {
        const group = this.drawingGroups.find(g => g.id === groupId);
        if (group) {
            Object.assign(group, updates);
            this.setUnsavedChanges(true);
            this.notify();
        }
    }

    loadProject(projectData) {
        this.clearPoints();
        this.currentProjectName = projectData.name || '未命名專案';
        this.lastPointPosition = null;
        this.selectedGroup = null;

        if (projectData.settings) {
            this.drawingHeight = projectData.settings.drawingHeight || 0;
            this.planeRotation = projectData.settings.planeRotation || { x: 0, y: 0, z: 0 };
            this.cameraSensitivity = projectData.settings.cameraSensitivity || 1.0;
            this.particleType = projectData.settings.particleType || 'flame';
            this.particleColor = projectData.settings.particleColor || '#ff0000';
            this.skillId = projectData.settings.skillId || 'MyDrawingSkill';
            this.gridSize = projectData.settings.gridSize || 10;
        }

        if (projectData.particles) {
            this.particlePoints = projectData.particles.map(p => ({
                ...p,
                id: p.id || crypto.randomUUID(),
                sphereMesh: null,
                lineSegment: null
            }));
        }

        if (projectData.groups) {
            this.drawingGroups = projectData.groups.map(g => ({
                ...g,
                id: g.id || crypto.randomUUID()
            }));
        }

        this.setUnsavedChanges(false);
        this.notify();
    }
}

export default StateManager;
