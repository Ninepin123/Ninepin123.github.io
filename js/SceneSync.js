import * as THREE from 'three';
import DrawingGroup from './DrawingGroup.js';

class SceneSync {
    constructor(stateManager, sceneManager) {
        this.stateManager = stateManager;
        this.sceneManager = sceneManager;
        this.particleObjectMap = new Map();
        this.groupObjectMap = new Map();
        this.lastGridSize = null;
    }

    sync(state, { isDragging = false } = {}) {
        // 同步群組
        const stateGroupIds = new Set(state.drawingGroups.map(g => g.id));
        const renderedGroupIds = new Set(this.groupObjectMap.keys());

        // 新增或更新群組
        for (const groupData of state.drawingGroups) {
            if (!renderedGroupIds.has(groupData.id)) {
                const group = DrawingGroup.fromJSON(groupData);

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
                const group = this.groupObjectMap.get(groupData.id);

                // 拖動期間不覆寫本地位置
                if (isDragging && group) {
                    continue;
                }

                if (group.particles.length !== groupData.particles.length) {
                    // 粒子數量不同，重新渲染
                    group.meshes.forEach(mesh => {
                        if (mesh.geometry) mesh.geometry.dispose();
                        if (mesh.material) mesh.material.dispose();
                        this.sceneManager.scene.remove(mesh);
                    });
                    group.meshes = [];

                    group.particles = groupData.particles;
                    group.bounds = group.calculateBounds();
                    group.position = group.calculateCenter();

                    group.particles.forEach(particle => {
                        const pointVec = new THREE.Vector3(particle.x, particle.y, particle.z);
                        const sphereMesh = this.sceneManager.addPoint({
                            point: pointVec,
                            color: particle.color || groupData.color
                        });
                        group.meshes.push(sphereMesh);
                    });
                }
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

        // 同步獨立粒子點（舊系統相容）
        const statePointIds = new Set(state.particlePoints.map(p => p.id));
        const renderedPointIds = new Set(this.particleObjectMap.keys());

        for (const pointData of state.particlePoints) {
            if (!renderedPointIds.has(pointData.id)) {
                const pointVec = new THREE.Vector3(pointData.x, pointData.y, pointData.z);
                const sphereMesh = this.sceneManager.addPoint({ point: pointVec, color: pointData.color });
                this.particleObjectMap.set(pointData.id, { sphereMesh });
            }
        }

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

    syncSelection(state, prevSelectedId, onSelectChange) {
        const nextSelectedId = state.selectedGroup ? state.selectedGroup.id : null;
        if (prevSelectedId !== nextSelectedId) {
            if (prevSelectedId && this.groupObjectMap.has(prevSelectedId)) {
                this.groupObjectMap.get(prevSelectedId).hideSelection(this.sceneManager.scene);
            }
            if (nextSelectedId && this.groupObjectMap.has(nextSelectedId)) {
                this.groupObjectMap.get(nextSelectedId).showSelection(this.sceneManager.scene);
            }
            onSelectChange(nextSelectedId);
        }
        return nextSelectedId;
    }

    getGroup(id) {
        return this.groupObjectMap.get(id);
    }

    getAllGroups() {
        return this.groupObjectMap.entries();
    }

    isEmpty(state) {
        return state.drawingGroups.length === 0 && state.particlePoints.length === 0;
    }
}

export default SceneSync;
