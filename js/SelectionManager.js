import * as THREE from 'three';

class SelectionManager {
    constructor(sceneManager, sceneSync) {
        this.sceneManager = sceneManager;
        this.sceneSync = sceneSync;

        // 選取狀態
        this.selectedGroupId = null;
        this.multiSelectedGroupIds = new Set();

        // 拖動狀態
        this.isDragging = false;
        this.dragPlane = null;
        this.dragStartOnPlane = null;
        this.dragStartCenters = new Map();

        // 框選狀態
        this.isMarqueeActive = false;
        this.marqueeStartScreen = null;
        this.selectionRectEl = null;
    }

    // === 選取 ===

    pickGroupUnderCursor(event) {
        const mouse = this.sceneManager.mouse;
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.sceneManager.raycaster.setFromCamera(mouse, this.sceneManager.camera);

        const meshes = [];
        for (const group of this.sceneSync.groupObjectMap.values()) {
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

        const intersects = this.sceneManager.raycaster.intersectObjects(meshes, false);
        if (intersects.length === 0) return null;

        const pickedObject = intersects[0].object;
        for (const group of this.sceneSync.groupObjectMap.values()) {
            if ((group.meshes && group.meshes.includes(pickedObject)) ||
                group.boundingBox === pickedObject ||
                (group.resizeHandles && group.resizeHandles.includes(pickedObject))) {
                return { group, object: pickedObject };
            }
        }
        return null;
    }

    getSelectedIdsHitByRay(event, idsToCheck) {
        const mouse = this.sceneManager.mouse;
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.sceneManager.raycaster.setFromCamera(mouse, this.sceneManager.camera);

        const ray = this.sceneManager.raycaster.ray;
        const hitIds = [];
        const tol = 0.05;
        idsToCheck.forEach(id => {
            const g = this.sceneSync.getGroup(id);
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

    selectGroup(groupId) {
        this.selectedGroupId = groupId;
        if (this.multiSelectedGroupIds.size === 0 || !this.multiSelectedGroupIds.has(groupId)) {
            this.multiSelectedGroupIds = new Set([groupId]);
        }
        const group = this.sceneSync.getGroup(groupId);
        if (group) group.showSelection(this.sceneManager.scene);
    }

    clearSelection() {
        if (this.selectedGroupId) {
            const prev = this.sceneSync.getGroup(this.selectedGroupId);
            if (prev) prev.hideSelection(this.sceneManager.scene);
        }
        this.multiSelectedGroupIds.forEach(id => {
            const g = this.sceneSync.getGroup(id);
            if (g) g.hideSelection(this.sceneManager.scene);
        });
        this.selectedGroupId = null;
        this.multiSelectedGroupIds.clear();
    }

    setMultiSelection(ids) {
        this.multiSelectedGroupIds = new Set(ids);
        if (ids.length > 0) {
            this.selectedGroupId = ids[0];
        }
        this.multiSelectedGroupIds.forEach(id => {
            const g = this.sceneSync.getGroup(id);
            if (g) g.showSelection(this.sceneManager.scene);
        });
    }

    // === 拖動 ===

    beginDrag(event, group) {
        this.isDragging = true;
        this.selectedGroupId = group.id;

        if (this.multiSelectedGroupIds.size === 0 || !this.multiSelectedGroupIds.has(group.id)) {
            this.multiSelectedGroupIds = new Set([group.id]);
        }

        this._setupDragPlane(event, new THREE.Vector3(group.position.x, group.position.y, group.position.z));
        this.dragStartCenters = new Map();

        const idsToPrepare = this.multiSelectedGroupIds.size > 0
            ? Array.from(this.multiSelectedGroupIds)
            : [group.id];
        idsToPrepare.forEach(id => {
            const g = this.sceneSync.getGroup(id);
            if (g) this.dragStartCenters.set(id, { ...g.position });
        });
    }

    beginDragExisting(event, idsToCheck) {
        this.isDragging = true;

        let planeCenter = null;
        if (this.selectedGroupId) {
            const g = this.sceneSync.getGroup(this.selectedGroupId);
            if (g) planeCenter = new THREE.Vector3(g.position.x, g.position.y, g.position.z);
        } else if (idsToCheck.length > 0) {
            const g = this.sceneSync.getGroup(idsToCheck[0]);
            if (g) planeCenter = new THREE.Vector3(g.position.x, g.position.y, g.position.z);
        }

        this._setupDragPlane(event, planeCenter || new THREE.Vector3());
        this.dragStartCenters = new Map();
        idsToCheck.forEach(id => {
            const g = this.sceneSync.getGroup(id);
            if (g) this.dragStartCenters.set(id, { ...g.position });
        });
        if (this.selectedGroupId && !this.dragStartCenters.has(this.selectedGroupId)) {
            const g = this.sceneSync.getGroup(this.selectedGroupId);
            if (g) this.dragStartCenters.set(this.selectedGroupId, { ...g.position });
        }
    }

    updateDrag(event) {
        if (!this.dragPlane || !this.dragStartOnPlane) return;

        const mouse = this.sceneManager.mouse;
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.sceneManager.raycaster.setFromCamera(mouse, this.sceneManager.camera);

        const curr = new THREE.Vector3();
        if (!this.sceneManager.raycaster.ray.intersectPlane(this.dragPlane, curr)) return;

        const dx = curr.x - this.dragStartOnPlane.x;
        const dy = curr.y - this.dragStartOnPlane.y;
        const dz = curr.z - this.dragStartOnPlane.z;

        const idsToMove = this.multiSelectedGroupIds.size > 0
            ? Array.from(this.multiSelectedGroupIds)
            : (this.selectedGroupId ? [this.selectedGroupId] : []);

        idsToMove.forEach(id => {
            const g = this.sceneSync.getGroup(id);
            const startCenter = this.dragStartCenters.get(id);
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
    }

    commitDrag(stateManager) {
        const idsToUpdate = this.multiSelectedGroupIds.size > 0
            ? Array.from(this.multiSelectedGroupIds)
            : (this.selectedGroupId ? [this.selectedGroupId] : []);

        idsToUpdate.forEach(id => {
            const g = this.sceneSync.getGroup(id);
            if (g) {
                stateManager.updateGroup(g.id, {
                    particles: g.particles,
                    position: g.position,
                    bounds: g.bounds
                });
            }
        });
    }

    clearDrag() {
        this.isDragging = false;
        this.dragPlane = null;
        this.dragStartOnPlane = null;
        this.dragStartCenters = new Map();
    }

    // === 框選 ===

    beginMarquee(start) {
        this.isMarqueeActive = true;
        this.marqueeStartScreen = start;
        this.createSelectionRect(start.x, start.y, start.x, start.y);
    }

    updateMarquee(current) {
        if (!this.isMarqueeActive || !this.marqueeStartScreen) return;
        this.updateSelectionRect(this.marqueeStartScreen.x, this.marqueeStartScreen.y, current.x, current.y);
    }

    finishMarquee(end) {
        if (!this.isMarqueeActive || !this.marqueeStartScreen) {
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
        for (const [id, group] of this.sceneSync.groupObjectMap.entries()) {
            const screen = this.worldToScreen(new THREE.Vector3(group.position.x, group.position.y, group.position.z));
            if (!screen) continue;
            if (screen.x >= minX && screen.x <= maxX && screen.y >= minY && screen.y <= maxY) {
                selected.push(id);
            }
        }

        this.isMarqueeActive = false;
        this.marqueeStartScreen = null;
        this.clearSelectionRect();
        return selected;
    }

    // === 座標轉換 ===

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

    // === 私有方法 ===

    _setupDragPlane(event, center) {
        const camDir = new THREE.Vector3();
        this.sceneManager.camera.getWorldDirection(camDir);
        this.dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, center);

        const mouse = this.sceneManager.mouse;
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.sceneManager.raycaster.setFromCamera(mouse, this.sceneManager.camera);

        const startOnPlane = new THREE.Vector3();
        this.sceneManager.raycaster.ray.intersectPlane(this.dragPlane, startOnPlane);
        this.dragStartOnPlane = startOnPlane.clone();
    }

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

    clearSelectionRect() {
        if (this.selectionRectEl && this.selectionRectEl.parentNode) {
            this.selectionRectEl.parentNode.removeChild(this.selectionRectEl);
        }
        this.selectionRectEl = null;
    }
}

export default SelectionManager;
