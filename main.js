import * as THREE from 'three';
import StateManager from './js/StateManager.js';
import ThreeScene from './js/ThreeScene.js';
import UIManager from './js/UIManager.js';
import ProjectManager from './js/ProjectManager.js';

class App {
    constructor() {
        this.canvas = document.querySelector('#scene-canvas');
        this.stateManager = new StateManager();
        this.sceneManager = new ThreeScene(this.canvas);
        this.uiManager = new UIManager(this.stateManager);
        this.projectManager = new ProjectManager(this.stateManager);

        this.particleObjectMap = new Map();
        this.MIN_DISTANCE = 0.2;

        this.connectModules();
        this.setupEventListeners();

        // Re-add the debug helper. Now that we use a server, it will be accessible.
        window.getPointCount = () => this.stateManager.getState().particlePoints.length;
    }

    connectModules() {
        // 將 UI 的專案管理按鈕與 ProjectManager 的功能綁定
        this.uiManager.bindProjectManager(this.projectManager);

        // 訂閱狀態變更，當狀態更新時，同步 3D 場景
        this.stateManager.subscribe(this.onStateChange.bind(this));
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    /**
     * 當狀態管理器中的狀態發生變化時，此函數會被調用。
     * 主要負責同步 3D 場景的視覺表現與當前的應用狀態。
     * @param {object} state - 最新的應用狀態
     */
    onStateChange(state) {
        // 更新場景設定，如繪圖高度、平面旋轉和相機控制
        this.sceneManager.updateHeight(state.drawingHeight);
        this.sceneManager.updatePlaneRotation(state.planeRotation);
        this.sceneManager.controls.enabled = (state.currentMode === 'camera' || !state.isDrawing);

        // --- 3D 物件與狀態同步 ---
        const statePointIds = new Set(state.particlePoints.map(p => p.id));
        const renderedPointIds = new Set(this.particleObjectMap.keys());

        // 新增: 找出在 state 中但不在場景中的點
        for (const pointData of state.particlePoints) {
            if (!renderedPointIds.has(pointData.id)) {
                const pointVec = new THREE.Vector3(pointData.x, pointData.y, pointData.z);
                const sphereMesh = this.sceneManager.addPoint({ point: pointVec, color: pointData.color });
                this.particleObjectMap.set(pointData.id, { sphereMesh });
            }
        }

        // 移除: 找出在場景中但已不在 state 中的點
        for (const id of renderedPointIds) {
            if (!statePointIds.has(id)) {
                const { sphereMesh, lineSegment } = this.particleObjectMap.get(id);
                this.sceneManager.removeObject(sphereMesh);
                if (lineSegment) {
                    this.sceneManager.removeObject(lineSegment);
                }
                this.particleObjectMap.delete(id);
            }
        }
    }

    handleMouseDown(event) {
        const state = this.stateManager.getState();
        if (state.currentMode === 'camera') return;

        this.stateManager.setDrawing(true);
        const intersectPoint = this.sceneManager.getIntersectPoint(event, state.drawingHeight, state.planeRotation);

        if (intersectPoint) {
            if (state.currentMode === 'point' || state.currentMode === 'brush') {
                const pointData = {
                    id: crypto.randomUUID(),
                    x: intersectPoint.x, y: intersectPoint.y, z: intersectPoint.z,
                    particleType: state.particleType, color: state.particleColor
                };
                this.stateManager.addPoint(pointData);
                this.stateManager.lastPointPosition = intersectPoint;
            } else if (state.currentMode === 'eraser') {
                this.eraseAtPosition(intersectPoint);
            }
        }
        
        if (state.currentMode === 'point') {
            this.stateManager.setDrawing(false);
        }
    }

    handleMouseMove(event) {
        const state = this.stateManager.getState();
        if (!state.isDrawing) return;

        const intersectPoint = this.sceneManager.getIntersectPoint(event, state.drawingHeight, state.planeRotation);
        if (!intersectPoint) return;

        if (state.currentMode === 'brush') {
            const lastPos = new THREE.Vector3(state.lastPointPosition.x, state.lastPointPosition.y, state.lastPointPosition.z);
            if (intersectPoint.distanceTo(lastPos) > this.MIN_DISTANCE) {
                const pointData = {
                    id: crypto.randomUUID(),
                    x: intersectPoint.x, y: intersectPoint.y, z: intersectPoint.z,
                    particleType: state.particleType, color: state.particleColor
                };
                this.stateManager.addPoint(pointData);
                this.stateManager.lastPointPosition = intersectPoint;
            }
        } else if (state.currentMode === 'eraser') {
            this.eraseAtPosition(intersectPoint);
        }
    }

    handleMouseUp() {
        this.stateManager.setDrawing(false);
    }
    
    eraseAtPosition(position, radius = 0.5) {
        const pointsToRemove = this.stateManager.getState().particlePoints.filter(p => {
            const pointPosition = new THREE.Vector3(p.x, p.y, p.z);
            return position.distanceTo(pointPosition) <= radius;
        });

        if (pointsToRemove.length > 0) {
            this.stateManager.removePoints(pointsToRemove);
        }
    }
}

// 初始化應用程式
new App();