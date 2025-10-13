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
        this.currentBrushPreviewMeshes = []; // 當前筆刷的預覽 meshes
        this.eraserPreviewMeshes = []; // 橡皮擦預覽的高亮 meshes
        this.shapeStartPoint = null; // 形狀繪製的起始點
        this.shapePreviewMesh = null; // 形狀預覽的 mesh
        this.toolPreviewMesh = null; // 工具預覽圓圈（筆刷/橡皮擦）
        this.MIN_DISTANCE = 0.2;
        this.BRUSH_RADIUS = 0.3; // 筆刷預覽半徑
        this.ERASER_RADIUS = 0.5; // 橡皮擦預覽半徑

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

    /**
     * 當狀態管理器中的狀態發生變化時，此函數會被調用。
     * 主要負責同步 3D 場景的視覺表現與當前的應用狀態。
     * @param {object} state - 最新的應用狀態
     */
    onStateChange(state) {
        // 更新場景設定，如繪圖高度、平面旋轉和相機控制
        this.sceneManager.updateHeight(state.drawingHeight);
        this.sceneManager.updatePlaneRotation(state.planeRotation);
        this.sceneManager.updateCameraSensitivity(state.cameraSensitivity);
        this.sceneManager.updateGridSize(state.gridSize);
        this.sceneManager.controls.enabled = (state.currentMode === 'camera' || !state.isDrawing);

        // 更新游標樣式
        this.cursorManager.updateCursor(state.currentMode);

        // 如果清空了所有內容，清理所有臨時預覽
        if (state.drawingGroups.length === 0 && state.particlePoints.length === 0) {
            // 清理筆刷預覽
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

        this.stateManager.setDrawing(true);
        const intersectPoint = this.sceneManager.getIntersectPoint(event, state.drawingHeight, state.planeRotation);

        if (intersectPoint) {
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

                // 創建第一個預覽點（半透明）
                const pointVec = new THREE.Vector3(pointData.x, pointData.y, pointData.z);
                const sphereMesh = this.sceneManager.addPoint({
                    point: pointVec,
                    color: state.particleColor,
                    opacity: 0.5
                });
                this.currentBrushPreviewMeshes.push(sphereMesh);

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

        const intersectPoint = this.sceneManager.getIntersectPoint(event, state.drawingHeight, state.planeRotation);

        // 只為橡皮擦顯示工具預覽
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

        // 如果沒有在繪製或沒有交點，則返回
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

                // 立即創建預覽粒子（半透明）
                const pointVec = new THREE.Vector3(pointData.x, pointData.y, pointData.z);
                const sphereMesh = this.sceneManager.addPoint({
                    point: pointVec,
                    color: state.particleColor,
                    opacity: 0.5
                });
                this.currentBrushPreviewMeshes.push(sphereMesh);

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

        // 筆刷模式：完成群組並保存
        if (state.currentMode === 'brush' && this.currentBrushGroup) {
            if (this.currentBrushGroup.particles.length > 0) {
                // 移除預覽 meshes
                this.currentBrushPreviewMeshes.forEach(mesh => {
                    this.sceneManager.removeObject(mesh);
                });
                this.currentBrushPreviewMeshes = [];

                // 添加正式的群組
                this.stateManager.addGroup(this.currentBrushGroup.toJSON());
            }
            this.currentBrushGroup = null;
        }

        // 形狀模式：完成形狀繪製
        if ((state.currentMode === 'rectangle' || state.currentMode === 'circle') && this.shapeStartPoint) {
            const intersectPoint = this.sceneManager.getIntersectPoint(event, state.drawingHeight, state.planeRotation);
            if (intersectPoint) {
                this.createShapeGroup(intersectPoint, state.currentMode, state);
            }
            this.clearShapePreview();
            this.shapeStartPoint = null;
        }

        this.stateManager.setDrawing(false);
        this.stateManager.setLastPointPosition(null);
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

        const start = this.shapeStartPoint;
        const width = Math.abs(endPoint.x - start.x);
        const depth = Math.abs(endPoint.z - start.z);
        const centerX = (start.x + endPoint.x) / 2;
        const centerZ = (start.z + endPoint.z) / 2;
        const y = start.y + 0.05; // 稍微抬高避免被平面遮擋

        // 如果形狀太小，不顯示預覽
        if (width < 0.1 || depth < 0.1) return;

        let geometry;
        if (shapeType === 'rectangle') {
            geometry = new THREE.PlaneGeometry(width, depth);
            geometry.rotateX(-Math.PI / 2);
        } else if (shapeType === 'circle') {
            const radius = Math.sqrt(width * width + depth * depth) / 2;
            geometry = new THREE.CircleGeometry(radius, 32);
            geometry.rotateX(-Math.PI / 2);
        }

        // 使用更明顯的材質
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthTest: false, // 確保總是可見
            depthWrite: false
        });

        this.shapePreviewMesh = new THREE.Mesh(geometry, material);
        this.shapePreviewMesh.position.set(centerX, y, centerZ);
        this.shapePreviewMesh.renderOrder = 999; // 確保在最上層渲染
        this.sceneManager.scene.add(this.shapePreviewMesh);

        // 同時添加邊框線以更明顯
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            depthTest: false
        });
        const line = new THREE.LineSegments(edges, lineMaterial);
        line.position.copy(this.shapePreviewMesh.position);
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
        const start = this.shapeStartPoint;
        const particles = [];
        const spacing = 0.2; // 粒子間距

        if (shapeType === 'rectangle') {
            // 生成矩形的粒子
            const minX = Math.min(start.x, endPoint.x);
            const maxX = Math.max(start.x, endPoint.x);
            const minZ = Math.min(start.z, endPoint.z);
            const maxZ = Math.max(start.z, endPoint.z);

            if (state.shapeFillMode === 'filled') {
                // 實心：填滿整個矩形
                for (let x = minX; x <= maxX; x += spacing) {
                    for (let z = minZ; z <= maxZ; z += spacing) {
                        particles.push({
                            id: crypto.randomUUID(),
                            x: x,
                            y: start.y,
                            z: z,
                            particleType: state.particleType,
                            color: state.particleColor
                        });
                    }
                }
            } else {
                // 空心：只畫四條邊
                // 上邊和下邊
                for (let x = minX; x <= maxX; x += spacing) {
                    particles.push({
                        id: crypto.randomUUID(),
                        x: x,
                        y: start.y,
                        z: minZ,
                        particleType: state.particleType,
                        color: state.particleColor
                    });
                    particles.push({
                        id: crypto.randomUUID(),
                        x: x,
                        y: start.y,
                        z: maxZ,
                        particleType: state.particleType,
                        color: state.particleColor
                    });
                }
                // 左邊和右邊（排除角落以避免重複）
                for (let z = minZ + spacing; z < maxZ; z += spacing) {
                    particles.push({
                        id: crypto.randomUUID(),
                        x: minX,
                        y: start.y,
                        z: z,
                        particleType: state.particleType,
                        color: state.particleColor
                    });
                    particles.push({
                        id: crypto.randomUUID(),
                        x: maxX,
                        y: start.y,
                        z: z,
                        particleType: state.particleType,
                        color: state.particleColor
                    });
                }
            }
        } else if (shapeType === 'circle') {
            // 生成圓形的粒子
            const centerX = (start.x + endPoint.x) / 2;
            const centerZ = (start.z + endPoint.z) / 2;
            const radius = Math.sqrt(
                Math.pow(endPoint.x - start.x, 2) +
                Math.pow(endPoint.z - start.z, 2)
            ) / 2;

            if (state.shapeFillMode === 'filled') {
                // 實心：填滿整個圓形
                const steps = Math.ceil(2 * Math.PI * radius / spacing);
                for (let i = 0; i <= steps; i++) {
                    const angle = (i / steps) * 2 * Math.PI;
                    for (let r = 0; r <= radius; r += spacing) {
                        const x = centerX + Math.cos(angle) * r;
                        const z = centerZ + Math.sin(angle) * r;
                        particles.push({
                            id: crypto.randomUUID(),
                            x: x,
                            y: start.y,
                            z: z,
                            particleType: state.particleType,
                            color: state.particleColor
                        });
                    }
                }
            } else {
                // 空心：只畫圓周
                const circumference = 2 * Math.PI * radius;
                const steps = Math.ceil(circumference / spacing);
                for (let i = 0; i < steps; i++) {
                    const angle = (i / steps) * 2 * Math.PI;
                    const x = centerX + Math.cos(angle) * radius;
                    const z = centerZ + Math.sin(angle) * radius;
                    particles.push({
                        id: crypto.randomUUID(),
                        x: x,
                        y: start.y,
                        z: z,
                        particleType: state.particleType,
                        color: state.particleColor
                    });
                }
            }
        }

        if (particles.length > 0) {
            const group = new DrawingGroup({
                type: shapeType,
                particles: particles,
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

        const radius = mode === 'brush' ? this.BRUSH_RADIUS : this.ERASER_RADIUS;
        const color = mode === 'brush' ? 0x00ff00 : 0xff0000;

        // 創建圓圈幾何
        const geometry = new THREE.CircleGeometry(radius, 32);
        geometry.rotateX(-Math.PI / 2);

        // 創建材質
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });

        this.toolPreviewMesh = new THREE.Mesh(geometry, material);
        this.toolPreviewMesh.position.set(position.x, position.y + 0.02, position.z);
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
        line.position.copy(this.toolPreviewMesh.position);
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