class StateManager {
    constructor() {
        this.particlePoints = [];
        this.currentMode = 'camera'; // 'camera', 'point', 'brush', 'eraser'
        this.drawingHeight = 0;
        this.planeRotation = { x: 0, y: 0, z: 0 };
        this.particleType = 'flame';
        this.particleColor = '#ff0000';
        this.isDrawing = false;
        this.lastPointPosition = null; // This will now be part of the official state.
        this.hasUnsavedChanges = false;
        this.currentProjectName = '未命名專案';
        this.cameraSensitivity = 1; // 新增相機靈敏度屬性

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
            currentMode: this.currentMode,
            drawingHeight: this.drawingHeight,
            planeRotation: this.planeRotation,
            particleType: this.particleType,
            particleColor: this.particleColor,
            isDrawing: this.isDrawing,
            lastPointPosition: this.lastPointPosition, // Add to state object
            hasUnsavedChanges: this.hasUnsavedChanges,
            currentProjectName: this.currentProjectName,
            cameraSensitivity: this.cameraSensitivity,
        };
    }

    // --- 狀態修改 ---
    setCameraSensitivity(sensitivity) {
        this.cameraSensitivity = sensitivity;
        this.notify();
    }
    setMode(mode) {
        this.currentMode = mode;
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

    setParticleSettings(type, color) {
        this.particleType = type;
        this.particleColor = color;
        this.notify();
    }

    setProjectName(name) {
        this.currentProjectName = name;
        this.setUnsavedChanges(true);
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
        const lastPoint = this.particlePoints.pop();
        if (lastPoint) {
            this.setUnsavedChanges(true);
        }
        this.notify();
        return lastPoint;
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
        this.particlePoints = [];
        if (hadPoints) {
            this.setUnsavedChanges(true);
        }
        this.notify();
    }

    loadProject(projectData) {
        this.clearPoints();
        this.currentProjectName = projectData.name || '未命名專案';
        this.lastPointPosition = null; // Reset on new project

        if (projectData.settings) {
            this.drawingHeight = projectData.settings.drawingHeight || 0;
            this.planeRotation = projectData.settings.planeRotation || { x: 0, y: 0, z: 0 };
            this.particleType = projectData.settings.particleType || 'flame';
            this.particleColor = projectData.settings.particleColor || '#ff0000';
            this.cameraSensitivity = projectData.settings.cameraSensitivity || 1;
        }

        if (projectData.particles) {
            this.particlePoints = projectData.particles.map(p => ({
                ...p,
                id: p.id || crypto.randomUUID(), // 確保向後兼容
                sphereMesh: null,
                lineSegment: null
            }));
        }

        this.setUnsavedChanges(false);
        this.notify();
    }
}

export default StateManager;