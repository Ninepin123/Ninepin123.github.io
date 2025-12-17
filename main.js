import * as THREE from 'three';
import StateManager from './js/StateManager.js';
import ThreeScene from './js/ThreeScene.js';
import UIManager from './js/UIManager.js';
import ProjectManager from './js/ProjectManager.js';
import LocalStorageManager from './js/LocalStorageManager.js';
import DrawingGroup from './js/DrawingGroup.js';
import CursorManager from './js/CursorManager.js';

class App {
    constructor() {
        this.canvas = document.querySelector('#scene-canvas');
        this.stateManager = new StateManager();
        this.sceneManager = new ThreeScene(this.canvas);
        this.uiManager = new UIManager(this.stateManager);
        this.projectManager = new ProjectManager(this.stateManager);
        this.localStorageManager = new LocalStorageManager(this.stateManager);
        this.cursorManager = new CursorManager(this.canvas);

        this.particleObjectMap = new Map();
        this.groupObjectMap = new Map(); // 儲存群組物件
        this.currentBrushGroup = null; // 當前正在繪製的筆刷群組
        this.currentBrushPreviewMeshes = []; // 當前筆刷預覽的半透明粒子
        this.eraserPreviewMeshes = []; // 橡皮擦預覽的高亮 meshes
        this.shapeStartPoint = null; // 形狀繪製的起始點
        this.shapePreviewMesh = null; // 形狀預覽的 mesh
        this.toolPreviewMesh = null; // 工具預覽圓圈（筆刷/橡皮擦）
        this.MIN_DISTANCE = 0.2;
        this.BRUSH_RADIUS = 0.3; // 筆刷預覽半徑
        this.ERASER_RADIUS = 0.5; // 橡皮擦預覽半徑

        // 選取/拖動相關狀態
        this.selectedGroupId = null;
        this.isDraggingSelection = false;
        this.dragStartPoint = null;
        this.selectedGroupStartCenter = null;
        this.multiSelectedGroupIds = new Set();
        this.selectedGroupsStartCenters = new Map();

        // 記錄上一次網格大小，避免每次狀態變更都重建網格
        this.lastGridSize = null;

        // 框選狀態與元素
        this.isMarqueeSelecting = false;
        this.marqueeStartScreen = null; // {x, y}
        this.selectionRectEl = null;

        // 拖動平面（與相機正對，通過選取中心）
        this.dragPlane = null;
        this.dragStartOnPlane = null;

        this.connectModules();
        this.setupEventListeners();
        this.initLocalStorage();
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

    getDrawingPlaneInfo() {
        const plane = this.sceneManager.dynamicTargetPlane;
        plane.updateMatrixWorld(true);

        const normal = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(plane.quaternion)
            .normalize();

        const worldToPlane = point => plane.worldToLocal(point.clone());
        const planeToWorld = point => plane.localToWorld(point.clone());

        return { plane, normal, worldToPlane, planeToWorld };
    }

    /**
     * 當狀態管理器中的狀態發生變化時，此函數會被調用。
     * 主要負責同步 3D 場景的視覺表現與當前的應用狀態。
     * @param {object} state - 最新的應用狀態
     */
    onStateChange(state) {
        // 先處理可能的網格大小變更（重建平面/網格）
        if (this.lastGridSize !== state.gridSize) {
            this.sceneManager.updateGridSize(state.gridSize);
            this.lastGridSize = state.gridSize;
        }

        // 更新場景設定：繪圖高度、平面旋轉、相機控制
        this.sceneManager.updateHeight(state.drawingHeight);
        this.sceneManager.updatePlaneRotation(state.planeRotation);
        this.sceneManager.updatePlaneOffset(state.planeOffset);
        this.sceneManager.updateCameraSensitivity(state.cameraSensitivity);
        this.sceneManager.controls.enabled = (state.currentMode === 'camera' || !state.isDrawing);

        // 更新游標樣式
        this.cursorManager.updateCursor(state.currentMode);

        // 如果清空了所有內容，清理所有臨時預覽
        if (state.drawingGroups.length === 0 && state.particlePoints.length === 0) {
            this.currentBrushPreviewMeshes.forEach(mesh => {
                this.sceneManager.removeObject(mesh);
            });
            this.currentBrushPreviewMeshes = [];
            this.currentBrushGroup = null;

            // 清理橡皮擦預覽
            this.clearEraserPreview();

            // 清理工具預覽
            this.clearToolPreview();

            // 清理形狀預覽
            this.clearShapePreview();
        }

        // --- 同步群組 ---
        const stateGroupIds = new Set(state.drawingGroups.map(g => g.id));
        const renderedGroupIds = new Set(this.groupObjectMap.keys());

        // 新增或更新群組
        for (const groupData of state.drawingGroups) {
            if (!renderedGroupIds.has(groupData.id)) {
                // 新群組：創建並渲染
                const group = DrawingGroup.fromJSON(groupData);

                // 渲染群組中的所有粒子
                group.particles.forEach(particle => {
                    const pointVec = new THREE.Vector3(particle.x, particle.y, particle.z);
                    const sphereMesh = this.sceneManager.addPoint({
                        point: pointVec,
                        color: particle.color || groupData.color
                    });
                    group.meshes.push(sphereMesh);
                });

                this.groupObjectMap.set(groupData.id, group);
            } else {
                // 現有群組：檢查是否需要更新
                const group = this.groupObjectMap.get(groupData.id);

                // 拖動期間，不覆寫本地群組位置/邊界，避免碰撞箱回彈
                if (this.isDraggingSelection && group) {
                    continue;
                }

                // 比較粒子數量，如果不同則需要重新渲染
                if (group.particles.length !== groupData.particles.length) {
                    // 清除舊的 meshes
                    group.meshes.forEach(mesh => {
                        if (mesh.geometry) mesh.geometry.dispose();
                        if (mesh.material) mesh.material.dispose();
                        this.sceneManager.scene.remove(mesh);
                    });
                    group.meshes = [];

                    // 更新群組資料
                    group.particles = groupData.particles;
                    group.bounds = group.calculateBounds();
                    group.position = group.calculateCenter();

                    // 重新渲染所有粒子
                    group.particles.forEach(particle => {
                        const pointVec = new THREE.Vector3(particle.x, particle.y, particle.z);
                        const sphereMesh = this.sceneManager.addPoint({
                            point: pointVec,
                            color: particle.color || groupData.color
                        });
                        group.meshes.push(sphereMesh);
                    });
                }
                // 若粒子數量相同，仍同步位置與邊界（例如拖動後提交的資料）
                if (group.particles.length === groupData.particles.length) {
                    group.particles = groupData.particles;
                    group.position = groupData.position || group.calculateCenter();
                    group.bounds = groupData.bounds || group.calculateBounds();
                    group.particles.forEach((p, idx) => {
                        const mesh = group.meshes[idx];
                        if (mesh) mesh.position.set(p.x, p.y, p.z);
                    });
                    group.updateVisuals(this.sceneManager.scene);
                }
            }
        }

        // 移除已刪除的群組
        for (const id of renderedGroupIds) {
            if (!stateGroupIds.has(id)) {
                const group = this.groupObjectMap.get(id);
                group.dispose(this.sceneManager.scene);
                this.groupObjectMap.delete(id);
            }
        }

        // --- 同步選取狀態顯示 ---
        const prevSelectedId = this.selectedGroupId;
        const nextSelectedId = state.selectedGroup ? state.selectedGroup.id : null;
        if (prevSelectedId !== nextSelectedId) {
            if (prevSelectedId && this.groupObjectMap.has(prevSelectedId)) {
                const prevGroup = this.groupObjectMap.get(prevSelectedId);
                prevGroup.hideSelection(this.sceneManager.scene);
            }
            this.selectedGroupId = nextSelectedId;
            if (nextSelectedId && this.groupObjectMap.has(nextSelectedId)) {
                const nextGroup = this.groupObjectMap.get(nextSelectedId);
                nextGroup.showSelection(this.sceneManager.scene);
            }
        }

        // --- 同步獨立粒子點（舊系統相容） ---
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
        // 在相機模式下，不執行任何操作，以避免與 OrbitControls 的事件衝突。
        if (state.currentMode === 'camera') {
            return;
        }

        const intersectPoint = this.sceneManager.getIntersectPoint(event, state.drawingHeight, state.planeRotation, state.planeOffset);

        // 中鍵點擊或無交點時，啟用相機控制（繪畫模式中也能調整視角）
        if (event.button === 1 || (intersectPoint === null && state.currentMode !== 'select')) {
            // 確保相機中心維持在原點，避免視角晃動
            this.sceneManager.controls.target.set(0, 0, 0);
            this.sceneManager.controls.update();
            this.sceneManager.controls.enabled = true;
            return;
        }

        this.stateManager.setDrawing(true);

        if (intersectPoint) {
            if (state.currentMode === 'select') {
                // 選取模式：嘗試選取群組
                const picked = this.pickGroupUnderCursor(event);
                if (picked) {
                    const { group } = picked;

                    // 若選取不同群組，更新選取並顯示邊界
                    if (this.selectedGroupId && this.selectedGroupId !== group.id) {
                        const prev = this.groupObjectMap.get(this.selectedGroupId);
                        if (prev) prev.hideSelection(this.sceneManager.scene);
                    }
                    this.selectedGroupId = group.id;
                    if (this.multiSelectedGroupIds.size > 0 && this.multiSelectedGroupIds.has(group.id)) {
                        // 維持既有多選集合
                    } else {
                        this.multiSelectedGroupIds = new Set([group.id]);
                        // 單選：只顯示當前群組選取視覺
                        group.showSelection(this.sceneManager.scene);
                    }
                    this.stateManager.setSelectedGroup({ id: group.id });

                    // 準備拖動資料（相機方向拖動平面 + 平面交點起始）
                    this.isDraggingSelection = true;
                    const camDir = new THREE.Vector3();
                    this.sceneManager.camera.getWorldDirection(camDir);
                    this.dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, new THREE.Vector3(group.position.x, group.position.y, group.position.z));
                    const mouse = this.sceneManager.mouse;
                    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
                    this.sceneManager.raycaster.setFromCamera(mouse, this.sceneManager.camera);
                    const startOnPlane = new THREE.Vector3();
                    this.sceneManager.raycaster.ray.intersectPlane(this.dragPlane, startOnPlane);
                    this.dragStartOnPlane = startOnPlane.clone();
                    this.selectedGroupStartCenter = { ...group.position };
                    // 建立所有將移動群組的起點中心
                    const idsToPrepare = this.multiSelectedGroupIds.size > 0 ? Array.from(this.multiSelectedGroupIds) : [group.id];
                    this.selectedGroupsStartCenters = new Map();
                    idsToPrepare.forEach(id => {
                        const g = this.groupObjectMap.get(id);
                        if (g) this.selectedGroupsStartCenters.set(id, { ...g.position });
                    });
                } else {
                    // 沒有直接點到粒子，但可能點在已選取群組的邊界內 → 開始拖動
                    // 使用射線直接測試是否命中已選群組的邊界盒（不依賴繪圖平面）
                    const idsToCheck = this.multiSelectedGroupIds.size > 0
                        ? Array.from(this.multiSelectedGroupIds)
                        : (this.selectedGroupId ? [this.selectedGroupId] : []);
                    const idsUnderRay = this.getSelectedIdsHitByRay(event, idsToCheck);
                    const clickedInsideSelection = idsUnderRay.length > 0;

                    if (clickedInsideSelection) {
                        // 使用現有的選取作為拖動對象
                        this.isDraggingSelection = true;
                        const camDir2 = new THREE.Vector3();
                        this.sceneManager.camera.getWorldDirection(camDir2);
                        let planeCenter = null;
                        if (this.selectedGroupId && this.groupObjectMap.has(this.selectedGroupId)) {
                            const g0 = this.groupObjectMap.get(this.selectedGroupId);
                            planeCenter = new THREE.Vector3(g0.position.x, g0.position.y, g0.position.z);
                        } else if (idsToCheck.length > 0) {
                            const g1 = this.groupObjectMap.get(idsToCheck[0]);
                            if (g1) planeCenter = new THREE.Vector3(g1.position.x, g1.position.y, g1.position.z);
                        }
                        this.dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir2, planeCenter || new THREE.Vector3());
                        const mouse2 = this.sceneManager.mouse;
                        mouse2.x = (event.clientX / window.innerWidth) * 2 - 1;
                        mouse2.y = -(event.clientY / window.innerHeight) * 2 + 1;
                        this.sceneManager.raycaster.setFromCamera(mouse2, this.sceneManager.camera);
                        const startOnPlane2 = new THREE.Vector3();
                        this.sceneManager.raycaster.ray.intersectPlane(this.dragPlane, startOnPlane2);
                        this.dragStartOnPlane = startOnPlane2.clone();
                        // 準備各群組起始中心
                        const idsToPrepare = idsToCheck.length > 0 ? idsToCheck : [];
                        this.selectedGroupsStartCenters = new Map();
                        idsToPrepare.forEach(id => {
                            const g = this.groupObjectMap.get(id);
                            if (g) this.selectedGroupsStartCenters.set(id, { ...g.position });
                        });
                        // 單選也準備起點中心
                        if (this.selectedGroupId && !this.selectedGroupsStartCenters.has(this.selectedGroupId)) {
                            const g = this.groupObjectMap.get(this.selectedGroupId);
                            if (g) this.selectedGroupsStartCenters.set(this.selectedGroupId, { ...g.position });
                        }
                        // 不更改 selection 狀態
                    } else {
                        // 點擊空白處：開始框選
                        this.beginMarqueeSelection({ x: event.clientX, y: event.clientY });
                        // 清除既有選取視覺
                        if (this.selectedGroupId && this.groupObjectMap.has(this.selectedGroupId)) {
                            const prev = this.groupObjectMap.get(this.selectedGroupId);
                            prev.hideSelection(this.sceneManager.scene);
                        }
                        this.multiSelectedGroupIds.forEach(id => {
                            const g = this.groupObjectMap.get(id);
                            if (g) g.hideSelection(this.sceneManager.scene);
                        });
                        this.selectedGroupId = null;
                        this.multiSelectedGroupIds.clear();
                        this.isDraggingSelection = false;
                        this.dragStartPoint = null;
                        this.selectedGroupStartCenter = null;
                        this.selectedGroupsStartCenters.clear();
                        this.stateManager.setSelectedGroup(null);
                    }
                }
                return; // 選擇模式處理完畢
            }
            if (state.currentMode === 'point') {
                // 點模式：創建單點群組
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

            } else if (state.currentMode === 'brush') {
                // 筆刷模式：開始新群組
                const pointData = {
                    id: crypto.randomUUID(),
                    x: intersectPoint.x, y: intersectPoint.y, z: intersectPoint.z,
                    particleType: state.particleType, color: state.particleColor
                };

                this.currentBrushGroup = new DrawingGroup({
                    type: 'brush',
                    particles: [pointData],
                    particleType: state.particleType,
                    color: state.particleColor
                });

                const pointVec = new THREE.Vector3(pointData.x, pointData.y, pointData.z);
                const previewMesh = this.sceneManager.addPoint({
                    point: pointVec,
                    color: state.particleColor,
                    opacity: 0.5
                });
                this.currentBrushPreviewMeshes.push(previewMesh);

                this.stateManager.setLastPointPosition(intersectPoint);

            } else if (state.currentMode === 'eraser') {
                // 橡皮擦模式：實際執行擦除
                this.eraseAtPosition(intersectPoint);
                this.clearEraserPreview();

            } else if (state.currentMode === 'rectangle' || state.currentMode === 'circle') {
                // 形狀模式：記錄起始點
                this.shapeStartPoint = intersectPoint.clone();
            }
        }
    }

    handleMouseMove(event) {
        const state = this.stateManager.getState();

        const intersectPoint = this.sceneManager.getIntersectPoint(event, state.drawingHeight, state.planeRotation, state.planeOffset);

        // 工具預覽：橡皮擦與筆刷
        if (state.currentMode === 'eraser') {
            if (intersectPoint) {
                this.updateToolPreview(intersectPoint, state.currentMode);
                this.updateEraserPreview(intersectPoint);
            } else {
                this.clearToolPreview();
                this.clearEraserPreview();
            }
        } else {
            this.clearToolPreview();
            this.clearEraserPreview();
        }

        // 框選更新（螢幕座標）
        if (this.isMarqueeSelecting) {
            this.updateMarqueeSelection({ x: event.clientX, y: event.clientY });
            // 框選時不進行其他操作
            return;
        }

        // 選擇模式拖動：使用相機方向的拖動平面
        if (state.currentMode === 'select' && this.isDraggingSelection && this.selectedGroupId) {
            if (!this.dragPlane || !this.dragStartOnPlane) return;
            // 計算當前滑鼠在拖動平面的交點
            const mouse = this.sceneManager.mouse;
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            this.sceneManager.raycaster.setFromCamera(mouse, this.sceneManager.camera);
            const curr = new THREE.Vector3();
            if (!this.sceneManager.raycaster.ray.intersectPlane(this.dragPlane, curr)) return;

            const dx = curr.x - this.dragStartOnPlane.x;
            const dy = curr.y - this.dragStartOnPlane.y;
            const dz = curr.z - this.dragStartOnPlane.z;

            const idsToMove = this.multiSelectedGroupIds.size > 0 ? Array.from(this.multiSelectedGroupIds) : [this.selectedGroupId];
            idsToMove.forEach(id => {
                const g = this.groupObjectMap.get(id);
                const startCenter = this.selectedGroupsStartCenters.get(id) || this.selectedGroupStartCenter;
                if (!g || !startCenter) return;
                const newPos = {
                    x: startCenter.x + dx,
                    y: startCenter.y + dy,
                    z: startCenter.z + dz
                };
                g.moveTo(newPos);
                g.particles.forEach((p, idx) => {
                    const mesh = g.meshes[idx];
                    if (mesh) mesh.position.set(p.x, p.y, p.z);
                });
                g.updateVisuals(this.sceneManager.scene);
            });
            return;
        }

        // 如果沒有在繪製或沒有交點，則返回（非選擇模式）
        if (!state.isDrawing) return;
        if (!intersectPoint) return;

        if (state.currentMode === 'brush' && this.currentBrushGroup && state.lastPointPosition) {
            const lastPos = new THREE.Vector3(state.lastPointPosition.x, state.lastPointPosition.y, state.lastPointPosition.z);
            if (intersectPoint.distanceTo(lastPos) > this.MIN_DISTANCE) {
                const pointData = {
                    id: crypto.randomUUID(),
                    x: intersectPoint.x, y: intersectPoint.y, z: intersectPoint.z,
                    particleType: state.particleType, color: state.particleColor
                };

                // 添加點到當前筆刷群組
                this.currentBrushGroup.addParticle(pointData);

                const pointVec = new THREE.Vector3(pointData.x, pointData.y, pointData.z);
                const previewMesh = this.sceneManager.addPoint({
                    point: pointVec,
                    color: state.particleColor,
                    opacity: 0.5
                });
                this.currentBrushPreviewMeshes.push(previewMesh);

                this.stateManager.setLastPointPosition(intersectPoint);
            }
        } else if (state.currentMode === 'eraser') {
            // 拖動橡皮擦時持續擦除
            this.eraseAtPosition(intersectPoint);

        } else if ((state.currentMode === 'rectangle' || state.currentMode === 'circle') && this.shapeStartPoint) {
            // 更新形狀預覽
            this.updateShapePreview(intersectPoint, state.currentMode);
        }
    }

    handleMouseUp(event) {
        const state = this.stateManager.getState();

        // 完成框選（若有）
        if (this.isMarqueeSelecting) {
            const selection = this.finishMarqueeSelection({ x: event.clientX, y: event.clientY });
            // 清除舊選取視覺
            if (this.selectedGroupId && this.groupObjectMap.has(this.selectedGroupId)) {
                const prev = this.groupObjectMap.get(this.selectedGroupId);
                prev.hideSelection(this.sceneManager.scene);
            }
            this.multiSelectedGroupIds.forEach(id => {
                const g = this.groupObjectMap.get(id);
                if (g) g.hideSelection(this.sceneManager.scene);
            });
            // 套用新選取
            this.multiSelectedGroupIds = new Set(selection);
            if (this.multiSelectedGroupIds.size > 0) {
                // 將第一個作為主選取（供現有 UI 使用）
                const firstId = Array.from(this.multiSelectedGroupIds)[0];
                this.selectedGroupId = firstId;
                this.stateManager.setSelectedGroup({ id: firstId });
            } else {
                this.selectedGroupId = null;
                this.stateManager.setSelectedGroup(null);
            }
            // 顯示視覺
            this.multiSelectedGroupIds.forEach(id => {
                const g = this.groupObjectMap.get(id);
                if (g) g.showSelection(this.sceneManager.scene);
            });
            // 結束框選流程
            this.isDraggingSelection = false;
            this.dragStartPoint = null;
            this.selectedGroupStartCenter = null;
            this.selectedGroupsStartCenters.clear();
        }

        // 選擇模式：若正在拖動，提交狀態更新
        if (state.currentMode === 'select' && this.isDraggingSelection && this.selectedGroupId) {
            const idsToUpdate = this.multiSelectedGroupIds.size > 0 ? Array.from(this.multiSelectedGroupIds) : [this.selectedGroupId];
            idsToUpdate.forEach(id => {
                const g = this.groupObjectMap.get(id);
                if (g) {
                    this.stateManager.updateGroup(g.id, {
                        particles: g.particles,
                        position: g.position,
                        bounds: g.bounds
                    });
                }
            });
            this.isDraggingSelection = false;
            this.dragStartPoint = null;
            this.selectedGroupStartCenter = null;
            this.selectedGroupsStartCenters.clear();
            this.dragPlane = null;
            this.dragStartOnPlane = null;
        }

        // 筆刷模式：完成群組並保存
        if (state.currentMode === 'brush' && this.currentBrushGroup) {
            if (this.currentBrushGroup.particles.length > 0) {
                this.currentBrushPreviewMeshes.forEach(mesh => {
                    this.sceneManager.removeObject(mesh);
                });
                this.currentBrushPreviewMeshes = [];

                // 添加正式的群組
                this.stateManager.addGroup(this.currentBrushGroup.toJSON());
            }
            this.currentBrushGroup = null;
        } else {
            this.currentBrushPreviewMeshes.forEach(mesh => {
                this.sceneManager.removeObject(mesh);
            });
            this.currentBrushPreviewMeshes = [];
        }

        // 形狀模式：完成形狀繪製
        if ((state.currentMode === 'rectangle' || state.currentMode === 'circle') && this.shapeStartPoint) {
            const intersectPoint = this.sceneManager.getIntersectPoint(event, state.drawingHeight, state.planeRotation, state.planeOffset);
            if (intersectPoint) {
                this.createShapeGroup(intersectPoint, state.currentMode, state);
            }
            this.clearShapePreview();
            this.shapeStartPoint = null;
        }

        this.stateManager.setDrawing(false);
        this.stateManager.setLastPointPosition(null);
    }

    /**
     * 在目前滑鼠位置嘗試選取群組
     */
    pickGroupUnderCursor(event) {
        // 設定 raycaster
        const mouse = this.sceneManager.mouse;
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.sceneManager.raycaster.setFromCamera(mouse, this.sceneManager.camera);

        // 收集所有群組的 meshes 以及可見的邊界框與控制點
        const meshes = [];
        for (const group of this.groupObjectMap.values()) {
            if (group.meshes && group.meshes.length > 0) {
                meshes.push(...group.meshes);
            }
            if (group.boundingBox) {
                meshes.push(group.boundingBox);
            }
            if (group.resizeHandles && group.resizeHandles.length > 0) {
                meshes.push(...group.resizeHandles);
            }
        }
        if (meshes.length === 0) return null;

        // 射線相交測試
        const intersects = this.sceneManager.raycaster.intersectObjects(meshes, false);
        if (intersects.length === 0) return null;

        const pickedObject = intersects[0].object;
        // 找到該 mesh 所屬的群組
        for (const group of this.groupObjectMap.values()) {
            if ((group.meshes && group.meshes.includes(pickedObject)) ||
                group.boundingBox === pickedObject ||
                (group.resizeHandles && group.resizeHandles.includes(pickedObject))) {
                return { group, object: pickedObject };
            }
        }
        return null;
    }

    /**
     * 傳回 ray 命中已選群組邊界盒的群組 IDs
     */
    getSelectedIdsHitByRay(event, idsToCheck) {
        const mouse = this.sceneManager.mouse;
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.sceneManager.raycaster.setFromCamera(mouse, this.sceneManager.camera);

        const ray = this.sceneManager.raycaster.ray;
        const hitIds = [];
        const tol = 0.05;
        idsToCheck.forEach(id => {
            const g = this.groupObjectMap.get(id);
            if (!g) return;
            const min = new THREE.Vector3(g.bounds.min.x, g.bounds.min.y, g.bounds.min.z);
            const max = new THREE.Vector3(g.bounds.max.x, g.bounds.max.y, g.bounds.max.z);
            const box = new THREE.Box3(min, max);
            box.expandByScalar(tol);
            const hitPoint = new THREE.Vector3();
            if (ray.intersectBox(box, hitPoint) !== null) {
                hitIds.push(id);
            }
        });
        return hitIds;
    }

    /** 框選：開始 */
    beginMarqueeSelection(start) {
        this.isMarqueeSelecting = true;
        this.marqueeStartScreen = start;
        this.createSelectionRect(start.x, start.y, start.x, start.y);
    }

    /** 框選：更新矩形 */
    updateMarqueeSelection(current) {
        if (!this.isMarqueeSelecting || !this.marqueeStartScreen) return;
        this.updateSelectionRect(this.marqueeStartScreen.x, this.marqueeStartScreen.y, current.x, current.y);
    }

    /** 框選：完成並回傳選取群組 IDs */
    finishMarqueeSelection(end) {
        if (!this.isMarqueeSelecting || !this.marqueeStartScreen) {
            this.clearSelectionRect();
            return [];
        }
        const x1 = this.marqueeStartScreen.x;
        const y1 = this.marqueeStartScreen.y;
        const x2 = end.x;
        const y2 = end.y;
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        const selected = [];
        for (const [id, group] of this.groupObjectMap.entries()) {
            const screen = this.worldToScreen(new THREE.Vector3(group.position.x, group.position.y, group.position.z));
            if (!screen) continue;
            if (screen.x >= minX && screen.x <= maxX && screen.y >= minY && screen.y <= maxY) {
                selected.push(id);
            }
        }

        this.isMarqueeSelecting = false;
        this.marqueeStartScreen = null;
        this.clearSelectionRect();
        return selected;
    }

    /** 世界座標轉螢幕座標 */
    worldToScreen(worldVec3) {
        const camera = this.sceneManager.camera;
        const renderer = this.sceneManager.renderer;
        if (!camera || !renderer) return null;
        const width = renderer.domElement.clientWidth || window.innerWidth;
        const height = renderer.domElement.clientHeight || window.innerHeight;
        const projected = worldVec3.clone().project(camera);
        const x = (projected.x + 1) / 2 * width;
        const y = (1 - projected.y) / 2 * height;
        return { x, y };
    }

    /** 建立矩形覆蓋層 */
    createSelectionRect(x1, y1, x2, y2) {
        if (!this.selectionRectEl) {
            const el = document.createElement('div');
            el.id = 'selection-rect-overlay';
            el.style.cssText = `
                position: fixed;
                z-index: 9999;
                border: 1px dashed #00aaff;
                background: rgba(0, 170, 255, 0.15);
                pointer-events: none;
                left: 0; top: 0; width: 0; height: 0;`;
            document.body.appendChild(el);
            this.selectionRectEl = el;
        }
        this.updateSelectionRect(x1, y1, x2, y2);
    }

    /** 更新矩形覆蓋層位置大小 */
    updateSelectionRect(x1, y1, x2, y2) {
        if (!this.selectionRectEl) return;
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        Object.assign(this.selectionRectEl.style, {
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
            display: 'block'
        });
    }

    /** 移除矩形覆蓋層 */
    clearSelectionRect() {
        if (this.selectionRectEl && this.selectionRectEl.parentNode) {
            this.selectionRectEl.parentNode.removeChild(this.selectionRectEl);
        }
        this.selectionRectEl = null;
    }

    eraseAtPosition(position, radius = 0.5) {
        const state = this.stateManager.getState();

        if (state.eraserMode === 'point') {
            // 點模式：擦除範圍內的個別粒子點
            // 從獨立粒子中找
            const pointsToRemove = state.particlePoints.filter(p => {
                const pointPosition = new THREE.Vector3(p.x, p.y, p.z);
                return position.distanceTo(pointPosition) <= radius;
            });

            if (pointsToRemove.length > 0) {
                this.stateManager.removePoints(pointsToRemove);
            }

            // 從群組中找並擦除個別粒子
            const groupsToUpdate = [];
            state.drawingGroups.forEach(groupData => {
                const group = this.groupObjectMap.get(groupData.id);
                if (!group) return;

                // 找出要移除的粒子
                const particlesToRemove = groupData.particles.filter(p => {
                    const pointPosition = new THREE.Vector3(p.x, p.y, p.z);
                    return position.distanceTo(pointPosition) <= radius;
                });

                if (particlesToRemove.length > 0) {
                    // 更新群組資料
                    const remainingParticles = groupData.particles.filter(p => {
                        const pointPosition = new THREE.Vector3(p.x, p.y, p.z);
                        return position.distanceTo(pointPosition) > radius;
                    });

                    if (remainingParticles.length === 0) {
                        // 如果群組沒有剩餘粒子，刪除整個群組
                        this.stateManager.removeGroup(groupData.id);
                    } else {
                        // 否則更新群組
                        this.stateManager.updateGroup(groupData.id, {
                            particles: remainingParticles
                        });
                    }
                }
            });

        } else if (state.eraserMode === 'group') {
            // 群組模式：擦除整個遇到的群組
            const groupsToRemove = [];

            state.drawingGroups.forEach(groupData => {
                // 檢查群組中是否有任何粒子在擦除範圍內
                const hasParticleInRange = groupData.particles.some(p => {
                    const pointPosition = new THREE.Vector3(p.x, p.y, p.z);
                    return position.distanceTo(pointPosition) <= radius;
                });

                if (hasParticleInRange) {
                    groupsToRemove.push(groupData.id);
                }
            });

            // 刪除所有符合條件的群組
            groupsToRemove.forEach(groupId => {
                this.stateManager.removeGroup(groupId);
            });

            // 也擦除獨立的粒子點
            const pointsToRemove = state.particlePoints.filter(p => {
                const pointPosition = new THREE.Vector3(p.x, p.y, p.z);
                return position.distanceTo(pointPosition) <= radius;
            });

            if (pointsToRemove.length > 0) {
                this.stateManager.removePoints(pointsToRemove);
            }
        }
    }

    initLocalStorage() {
        // 初始化 localStorage 自動儲存
        this.localStorageManager.init();

        // 顯示儲存空間資訊（開發用）
        const storageInfo = this.localStorageManager.getStorageInfo();
        if (storageInfo) {
            console.log(`[Storage] 使用量: ${storageInfo.totalSize}MB (約 ${storageInfo.usage}%)`);
        }
    }

    /**
     * 更新形狀預覽
     */
    updateShapePreview(endPoint, shapeType) {
        // 移除舊的預覽
        this.clearShapePreview();

        if (!this.shapeStartPoint) return;

        const { plane, normal, worldToPlane, planeToWorld } = this.getDrawingPlaneInfo();
        const startLocal = worldToPlane(this.shapeStartPoint);
        const endLocal = worldToPlane(endPoint);

        const sizeX = Math.abs(endLocal.x - startLocal.x);
        const sizeZ = Math.abs(endLocal.z - startLocal.z);

        let geometry = null;

        if (shapeType === 'rectangle') {
            if (sizeX < 0.1 || sizeZ < 0.1) return;
            // 預先旋轉 geometry 使其位於 XZ 平面，配合 plane.quaternion 後能正確對齊繪畫平面
            geometry = new THREE.PlaneGeometry(sizeX, sizeZ).rotateX(-Math.PI / 2);
        } else if (shapeType === 'circle') {
            const radius = Math.sqrt(
                Math.pow(endLocal.x - startLocal.x, 2) +
                Math.pow(endLocal.z - startLocal.z, 2)
            ) / 2;
            if (sizeX < 0.1 || sizeZ < 0.1) return;
            // 預先旋轉 geometry 使其位於 XZ 平面，配合 plane.quaternion 後能正確對齊繪畫平面
            geometry = new THREE.CircleGeometry(radius, 32).rotateX(-Math.PI / 2);
        } else {
            return;
        }

        const centerLocal = new THREE.Vector3(
            (startLocal.x + endLocal.x) / 2,
            0,
            (startLocal.z + endLocal.z) / 2
        );
        const previewOffset = normal.clone().multiplyScalar(0.02);
        const previewPosition = planeToWorld(centerLocal).add(previewOffset);

        // 使用更明顯的材質
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });

        this.shapePreviewMesh = new THREE.Mesh(geometry, material);
        this.shapePreviewMesh.position.copy(previewPosition);
        this.shapePreviewMesh.setRotationFromQuaternion(plane.quaternion);
        this.shapePreviewMesh.renderOrder = 999;
        this.sceneManager.scene.add(this.shapePreviewMesh);

        // 同時添加邊框線以更明顯
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            depthTest: false
        });
        const line = new THREE.LineSegments(edges, lineMaterial);
        line.position.copy(previewPosition);
        line.setRotationFromQuaternion(plane.quaternion);
        line.renderOrder = 1000;
        this.sceneManager.scene.add(line);

        // 儲存邊框線以便之後清除
        this.shapePreviewMesh.userData.edgeLine = line;
    }

    /**
     * 清除形狀預覽
     */
    clearShapePreview() {
        if (this.shapePreviewMesh) {
            // 清除邊框線
            if (this.shapePreviewMesh.userData.edgeLine) {
                this.sceneManager.scene.remove(this.shapePreviewMesh.userData.edgeLine);
                this.shapePreviewMesh.userData.edgeLine.geometry.dispose();
                this.shapePreviewMesh.userData.edgeLine.material.dispose();
            }

            // 清除主 mesh
            this.sceneManager.scene.remove(this.shapePreviewMesh);
            this.shapePreviewMesh.geometry.dispose();
            this.shapePreviewMesh.material.dispose();
            this.shapePreviewMesh = null;
        }
    }

    /**
     * 創建形狀群組
     */
    createShapeGroup(endPoint, shapeType, state) {
        if (!this.shapeStartPoint) return;

        const particles = [];
        const spacing = 0.2; // 粒子間距
        const { plane, worldToPlane, planeToWorld } = this.getDrawingPlaneInfo();

        const startLocal = worldToPlane(this.shapeStartPoint);
        const endLocal = worldToPlane(endPoint);

        const addLocalParticle = (x, z) => {
            const worldPoint = planeToWorld(new THREE.Vector3(x, 0, z));
            particles.push({
                id: crypto.randomUUID(),
                x: worldPoint.x,
                y: worldPoint.y,
                z: worldPoint.z,
                particleType: state.particleType,
                color: state.particleColor
            });
        };

        if (shapeType === 'rectangle') {
            const minX = Math.min(startLocal.x, endLocal.x);
            const maxX = Math.max(startLocal.x, endLocal.x);
            const minZ = Math.min(startLocal.z, endLocal.z);
            const maxZ = Math.max(startLocal.z, endLocal.z);

            const width = maxX - minX;
            const depth = maxZ - minZ;
            const stepCountX = width > 0 ? Math.ceil(width / spacing) : 0;
            const stepCountZ = depth > 0 ? Math.ceil(depth / spacing) : 0;

            if (state.shapeFillMode === 'filled') {
                for (let ix = 0; ix <= stepCountX; ix++) {
                    const x = minX + (width * ix) / (stepCountX === 0 ? 1 : stepCountX);
                    for (let iz = 0; iz <= stepCountZ; iz++) {
                        const z = minZ + (depth * iz) / (stepCountZ === 0 ? 1 : stepCountZ);
                        addLocalParticle(x, z);
                    }
                }
            } else {
                for (let ix = 0; ix <= stepCountX; ix++) {
                    const x = minX + (width * ix) / (stepCountX === 0 ? 1 : stepCountX);
                    addLocalParticle(x, minZ);
                    if (stepCountZ > 0) {
                        addLocalParticle(x, maxZ);
                    }
                }
                if (stepCountZ > 0) {
                    for (let iz = 1; iz < stepCountZ; iz++) {
                        const z = minZ + (depth * iz) / stepCountZ;
                        addLocalParticle(minX, z);
                        if (stepCountX > 0) {
                            addLocalParticle(maxX, z);
                        }
                    }
                }
            }
        } else if (shapeType === 'circle') {
            const centerLocalX = (startLocal.x + endLocal.x) / 2;
            const centerLocalZ = (startLocal.z + endLocal.z) / 2;
            const dx = endLocal.x - startLocal.x;
            const dz = endLocal.z - startLocal.z;
            const radius = Math.sqrt(dx * dx + dz * dz) / 2;

            if (radius < spacing * 0.5) {
                addLocalParticle(centerLocalX, centerLocalZ);
            } else if (state.shapeFillMode === 'filled') {
                const angleSteps = Math.max(12, Math.ceil((2 * Math.PI * radius) / spacing));
                const radialSteps = Math.max(1, Math.ceil(radius / spacing));
                for (let i = 0; i <= angleSteps; i++) {
                    const angle = (i / angleSteps) * 2 * Math.PI;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    for (let rStep = 0; rStep <= radialSteps; rStep++) {
                        const r = (radius * rStep) / radialSteps;
                        const x = centerLocalX + cos * r;
                        const z = centerLocalZ + sin * r;
                        addLocalParticle(x, z);
                    }
                }
            } else {
                const angleSteps = Math.max(24, Math.ceil((2 * Math.PI * radius) / spacing));
                for (let i = 0; i < angleSteps; i++) {
                    const angle = (i / angleSteps) * 2 * Math.PI;
                    const x = centerLocalX + Math.cos(angle) * radius;
                    const z = centerLocalZ + Math.sin(angle) * radius;
                    addLocalParticle(x, z);
                }
            }
        }

        if (particles.length > 0) {
            const group = new DrawingGroup({
                type: shapeType,
                particles,
                particleType: state.particleType,
                color: state.particleColor
            });

            this.stateManager.addGroup(group.toJSON());
        }
    }

    /**
     * 更新工具預覽圓圈（筆刷/橡皮擦）
     */
    updateToolPreview(position, mode) {
        // 清除舊的預覽
        this.clearToolPreview();

        const { plane, normal } = this.getDrawingPlaneInfo();
        const radius = mode === 'brush' ? this.BRUSH_RADIUS : this.ERASER_RADIUS;
        const color = mode === 'brush' ? 0x00ff00 : 0xff0000;

        // 創建圓圈幾何
        const geometry = new THREE.CircleGeometry(radius, 32);

        // 創建材質
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });

        const previewPosition = position.clone().add(normal.clone().multiplyScalar(0.02));
        this.toolPreviewMesh = new THREE.Mesh(geometry, material);
        this.toolPreviewMesh.position.copy(previewPosition);
        this.toolPreviewMesh.setRotationFromQuaternion(plane.quaternion);
        this.toolPreviewMesh.renderOrder = 998;
        this.sceneManager.scene.add(this.toolPreviewMesh);

        // 添加邊框線
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: color,
            linewidth: 2,
            depthTest: false
        });
        const line = new THREE.LineSegments(edgesGeometry, lineMaterial);
        line.position.copy(previewPosition);
        line.setRotationFromQuaternion(plane.quaternion);
        line.renderOrder = 999;
        this.sceneManager.scene.add(line);

        // 儲存邊框線
        this.toolPreviewMesh.userData.edgeLine = line;
    }

    /**
     * 清除工具預覽
     */
    clearToolPreview() {
        if (this.toolPreviewMesh) {
            // 清除邊框線
            if (this.toolPreviewMesh.userData.edgeLine) {
                this.sceneManager.scene.remove(this.toolPreviewMesh.userData.edgeLine);
                this.toolPreviewMesh.userData.edgeLine.geometry.dispose();
                this.toolPreviewMesh.userData.edgeLine.material.dispose();
            }

            // 清除主 mesh
            this.sceneManager.scene.remove(this.toolPreviewMesh);
            this.toolPreviewMesh.geometry.dispose();
            this.toolPreviewMesh.material.dispose();
            this.toolPreviewMesh = null;
        }
    }

    /**
     * 獲取橡皮擦範圍內的點和群組
     */
    getPointsInEraserRange(position, radius = 0.5) {
        const state = this.stateManager.getState();
        const result = {
            particleMeshes: [], // 要高亮的粒子 meshes
            groupIds: []        // 要高亮的群組 IDs
        };

        if (state.eraserMode === 'point') {
            // 點模式：收集範圍內的個別粒子 meshes
            // 從獨立粒子中找
            state.particlePoints.forEach(p => {
                const pointPosition = new THREE.Vector3(p.x, p.y, p.z);
                if (position.distanceTo(pointPosition) <= radius) {
                    const particleObj = this.particleObjectMap.get(p.id);
                    if (particleObj && particleObj.sphereMesh) {
                        result.particleMeshes.push(particleObj.sphereMesh);
                    }
                }
            });

            // 從群組中找
            state.drawingGroups.forEach(groupData => {
                const group = this.groupObjectMap.get(groupData.id);
                if (!group) return;

                groupData.particles.forEach((particle, index) => {
                    const pointPosition = new THREE.Vector3(particle.x, particle.y, particle.z);
                    if (position.distanceTo(pointPosition) <= radius) {
                        if (group.meshes[index]) {
                            result.particleMeshes.push(group.meshes[index]);
                        }
                    }
                });
            });

        } else if (state.eraserMode === 'group') {
            // 群組模式：收集整個群組的所有 meshes
            state.drawingGroups.forEach(groupData => {
                const hasParticleInRange = groupData.particles.some(p => {
                    const pointPosition = new THREE.Vector3(p.x, p.y, p.z);
                    return position.distanceTo(pointPosition) <= radius;
                });

                if (hasParticleInRange) {
                    const group = this.groupObjectMap.get(groupData.id);
                    if (group) {
                        result.particleMeshes.push(...group.meshes);
                        result.groupIds.push(groupData.id);
                    }
                }
            });

            // 也包含獨立的粒子點
            state.particlePoints.forEach(p => {
                const pointPosition = new THREE.Vector3(p.x, p.y, p.z);
                if (position.distanceTo(pointPosition) <= radius) {
                    const particleObj = this.particleObjectMap.get(p.id);
                    if (particleObj && particleObj.sphereMesh) {
                        result.particleMeshes.push(particleObj.sphereMesh);
                    }
                }
            });
        }

        return result;
    }

    /**
     * 更新橡皮擦預覽
     */
    updateEraserPreview(position) {
        // 清除舊的預覽
        this.clearEraserPreview();

        const radius = this.ERASER_RADIUS;
        const pointsInRange = this.getPointsInEraserRange(position, radius);

        // 為每個將被擦除的粒子創建紅色高亮球
        pointsInRange.particleMeshes.forEach(mesh => {
            const highlightGeometry = new THREE.SphereGeometry(0.12, 16, 16);
            const highlightMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.6,
                depthTest: false,
                depthWrite: false
            });

            const highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
            highlightMesh.position.copy(mesh.position);
            highlightMesh.renderOrder = 997; // 在工具預覽之下
            this.sceneManager.scene.add(highlightMesh);
            this.eraserPreviewMeshes.push(highlightMesh);
        });
    }

    /**
     * 清除橡皮擦預覽
     */
    clearEraserPreview() {
        this.eraserPreviewMeshes.forEach(mesh => {
            this.sceneManager.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.eraserPreviewMeshes = [];
    }
}

// 初始化應用程式
new App();
