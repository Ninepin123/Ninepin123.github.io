import * as THREE from 'three';
import StateManager from './js/StateManager.js';
import ThreeScene from './js/ThreeScene.js';
import UIManager from './js/UIManager.js';
import ProjectManager from './js/ProjectManager.js';
import LocalStorageManager from './js/LocalStorageManager.js';
import DrawingGroup from './js/DrawingGroup.js';
import CursorManager from './js/CursorManager.js';
import ToolPreview from './js/ToolPreview.js';
import BrushTool from './js/BrushTool.js';
import ShapeTool from './js/ShapeTool.js';
import SceneSync from './js/SceneSync.js';
import EraserTool from './js/EraserTool.js';
import SelectionManager from './js/SelectionManager.js';

class App {
    constructor() {
        this.canvas = document.querySelector('#scene-canvas');
        this.stateManager = new StateManager();
        this.sceneManager = new ThreeScene(this.canvas);
        this.uiManager = new UIManager(this.stateManager);
        this.projectManager = new ProjectManager(this.stateManager);
        this.localStorageManager = new LocalStorageManager(this.stateManager);
        this.cursorManager = new CursorManager(this.canvas);

        this.sceneSync = new SceneSync(this.stateManager, this.sceneManager);
        this.toolPreview = new ToolPreview(this.sceneManager);
        this.brushTool = new BrushTool(this.sceneManager);
        this.shapeTool = new ShapeTool(this.sceneManager);
        this.eraserTool = new EraserTool(this.stateManager, this.sceneManager, this.sceneSync);
        this.selectionManager = new SelectionManager(this.sceneManager, this.sceneSync);

        this.BRUSH_RADIUS = 0.3;
        this.ERASER_RADIUS = 0.5;

        this.connectModules();
        this.setupEventListeners();
        this.initLocalStorage();
    }

    connectModules() {
        this.uiManager.bindProjectManager(this.projectManager);
        this.stateManager.subscribe(this.onStateChange.bind(this));
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    onStateChange(state) {
        // 網格大小
        if (this.sceneSync.lastGridSize !== state.gridSize) {
            this.sceneManager.updateGridSize(state.gridSize);
            this.sceneSync.lastGridSize = state.gridSize;
        }

        // 場景設定
        this.sceneManager.updateHeight(state.drawingHeight);
        this.sceneManager.updatePlaneRotation(state.planeRotation);
        this.sceneManager.updatePlaneOffset(state.planeOffset);
        this.sceneManager.updateCameraSensitivity(state.cameraSensitivity);
        this.sceneManager.controls.enabled = (state.currentMode === 'camera' || !state.isDrawing);

        this.cursorManager.updateCursor(state.currentMode);

        // 場景同步
        this.sceneSync.sync(state, { isDragging: this.selectionManager.isDragging });

        // 選取狀態同步
        this.selectionManager.selectedGroupId = this.sceneSync.syncSelection(
            state,
            this.selectionManager.selectedGroupId,
            (newId) => { this.selectionManager.selectedGroupId = newId; }
        );

        // 清空時清理所有預覽
        if (this.sceneSync.isEmpty(state)) {
            this.brushTool.cleanup();
            this.eraserTool.clearPreview();
            this.toolPreview.clear();
            this.shapeTool.clearPreview();
        }
    }

    handleMouseDown(event) {
        const state = this.stateManager.getState();
        if (state.currentMode === 'camera') return;

        const intersectPoint = this.sceneManager.getIntersectPoint(
            event, state.drawingHeight, state.planeRotation, state.planeOffset
        );

        if (event.button === 1 || (intersectPoint === null && state.currentMode !== 'select')) {
            this.sceneManager.controls.target.set(0, 0, 0);
            this.sceneManager.controls.update();
            this.sceneManager.controls.enabled = true;
            return;
        }

        this.stateManager.setDrawing(true);

        if (!intersectPoint) return;

        switch (state.currentMode) {
            case 'select':
                this._handleSelectDown(event, intersectPoint, state);
                break;
            case 'point':
                this._handlePointDown(intersectPoint, state);
                break;
            case 'brush':
                this.brushTool.startStroke(intersectPoint, state);
                this.stateManager.setLastPointPosition(intersectPoint);
                break;
            case 'eraser':
                this.eraserTool.eraseAtPosition(intersectPoint);
                this.eraserTool.clearPreview();
                break;
            case 'rectangle':
            case 'circle':
                this.shapeTool.startShape(intersectPoint);
                break;
        }
    }

    handleMouseMove(event) {
        const state = this.stateManager.getState();
        const intersectPoint = this.sceneManager.getIntersectPoint(
            event, state.drawingHeight, state.planeRotation, state.planeOffset
        );

        // 工具預覽（橡皮擦）
        if (state.currentMode === 'eraser') {
            if (intersectPoint) {
                this.toolPreview.show(intersectPoint, 'eraser', this.ERASER_RADIUS);
                this.eraserTool.updatePreview(intersectPoint);
            } else {
                this.toolPreview.clear();
                this.eraserTool.clearPreview();
            }
        } else {
            this.toolPreview.clear();
            this.eraserTool.clearPreview();
        }

        // 框選更新
        if (this.selectionManager.isMarqueeActive) {
            this.selectionManager.updateMarquee({ x: event.clientX, y: event.clientY });
            return;
        }

        // 選擇模式拖動
        if (state.currentMode === 'select' && this.selectionManager.isDragging && this.selectionManager.selectedGroupId) {
            this.selectionManager.updateDrag(event);
            return;
        }

        if (!state.isDrawing || !intersectPoint) return;

        switch (state.currentMode) {
            case 'brush': {
                const result = this.brushTool.continueStroke(intersectPoint, state, state.lastPointPosition);
                if (result) this.stateManager.setLastPointPosition(intersectPoint);
                break;
            }
            case 'eraser':
                this.eraserTool.eraseAtPosition(intersectPoint);
                break;
            case 'rectangle':
            case 'circle':
                if (this.shapeTool.isActive()) {
                    this.shapeTool.updatePreview(intersectPoint, state.currentMode);
                }
                break;
        }
    }

    handleMouseUp(event) {
        const state = this.stateManager.getState();

        // 完成框選
        if (this.selectionManager.isMarqueeActive) {
            const selectedIds = this.selectionManager.finishMarquee({ x: event.clientX, y: event.clientY });
            this.selectionManager.clearSelection();
            if (selectedIds.length > 0) {
                this.selectionManager.setMultiSelection(selectedIds);
                this.stateManager.setSelectedGroup({ id: selectedIds[0] });
            } else {
                this.stateManager.setSelectedGroup(null);
            }
            this.selectionManager.clearDrag();
        }

        // 選擇模式拖動提交
        if (state.currentMode === 'select' && this.selectionManager.isDragging && this.selectionManager.selectedGroupId) {
            this.selectionManager.commitDrag(this.stateManager);
            this.selectionManager.clearDrag();
        }

        // 筆刷完成
        if (state.currentMode === 'brush') {
            const group = this.brushTool.finishStroke();
            if (group) {
                this.stateManager.addGroup(group.toJSON());
            }
        } else {
            this.brushTool.cancelStroke();
        }

        // 形狀完成
        if ((state.currentMode === 'rectangle' || state.currentMode === 'circle') && this.shapeTool.isActive()) {
            const intersectPoint = this.sceneManager.getIntersectPoint(
                event, state.drawingHeight, state.planeRotation, state.planeOffset
            );
            if (intersectPoint) {
                const group = this.shapeTool.createShape(intersectPoint, state.currentMode, state);
                if (group) this.stateManager.addGroup(group.toJSON());
            }
            this.shapeTool.clearPreview();
        }

        this.stateManager.setDrawing(false);
        this.stateManager.setLastPointPosition(null);
    }

    // === 選取模式輔助 ===

    _handleSelectDown(event, intersectPoint, state) {
        const picked = this.selectionManager.pickGroupUnderCursor(event);

        if (picked) {
            const { group } = picked;

            // 清除舊選取視覺
            if (this.selectionManager.selectedGroupId && this.selectionManager.selectedGroupId !== group.id) {
                const prev = this.sceneSync.getGroup(this.selectionManager.selectedGroupId);
                if (prev) prev.hideSelection(this.sceneManager.scene);
            }

            this.selectionManager.selectGroup(group.id);
            this.stateManager.setSelectedGroup({ id: group.id });
            this.selectionManager.beginDrag(event, group);
        } else {
            // 檢查是否點在已選取群組邊界內
            const idsToCheck = this.selectionManager.multiSelectedGroupIds.size > 0
                ? Array.from(this.selectionManager.multiSelectedGroupIds)
                : (this.selectionManager.selectedGroupId ? [this.selectionManager.selectedGroupId] : []);
            const idsUnderRay = this.selectionManager.getSelectedIdsHitByRay(event, idsToCheck);

            if (idsUnderRay.length > 0) {
                this.selectionManager.beginDragExisting(event, idsToCheck);
            } else {
                // 點擊空白處：開始框選
                this.selectionManager.clearSelection();
                this.selectionManager.beginMarquee({ x: event.clientX, y: event.clientY });
                this.selectionManager.clearDrag();
                this.stateManager.setSelectedGroup(null);
            }
        }
    }

    _handlePointDown(intersectPoint, state) {
        const pointData = {
            id: crypto.randomUUID(),
            x: intersectPoint.x, y: intersectPoint.y, z: intersectPoint.z,
            particleType: state.particleType, color: state.particleColor
        };
        const group = new DrawingGroup({
            type: 'point',
            particles: [pointData],
            particleType: state.particleType,
            color: state.particleColor
        });
        this.stateManager.addGroup(group.toJSON());
        this.stateManager.setDrawing(false);
    }

    initLocalStorage() {
        this.localStorageManager.init();
        const storageInfo = this.localStorageManager.getStorageInfo();
        if (storageInfo) {
            console.log(`[Storage] 使用量: ${storageInfo.totalSize}MB (約 ${storageInfo.usage}%)`);
        }
    }
}

new App();
