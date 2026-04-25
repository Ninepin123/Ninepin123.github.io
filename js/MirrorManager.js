import * as THREE from 'three';

/**
 * 將 state 中的鏡子陣列同步成場景中的線段視覺。
 * 鏡子是 XZ 平面上的線段：在繪圖高度貼一條淺色虛線。
 */
class MirrorManager {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.mirrorMeshes = new Map(); // id -> THREE.Object3D
    }

    sync(mirrors, drawingHeight) {
        const aliveIds = new Set();

        for (const mirror of mirrors) {
            aliveIds.add(mirror.id);
            const existing = this.mirrorMeshes.get(mirror.id);
            if (existing) {
                this._updateMirrorMesh(existing, mirror, drawingHeight);
            } else {
                const mesh = this._createMirrorMesh(mirror, drawingHeight);
                this.sceneManager.scene.add(mesh);
                this.mirrorMeshes.set(mirror.id, mesh);
            }
        }

        // 移除已刪除的鏡子
        for (const [id, mesh] of this.mirrorMeshes.entries()) {
            if (!aliveIds.has(id)) {
                this._disposeMirrorMesh(mesh);
                this.mirrorMeshes.delete(id);
            }
        }
    }

    _createMirrorMesh(mirror, y) {
        const group = new THREE.Group();

        // 主線段
        const lineGeom = new THREE.BufferGeometry();
        lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(
            [mirror.x1, y + 0.01, mirror.z1, mirror.x2, y + 0.01, mirror.z2], 3
        ));
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x66ccff,
            linewidth: 3,
            transparent: true,
            opacity: 0.9,
            depthTest: false
        });
        const line = new THREE.Line(lineGeom, lineMat);
        line.renderOrder = 998;
        group.add(line);

        // 兩個端點小球
        const handleGeom = new THREE.SphereGeometry(0.12, 12, 12);
        const handleMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, depthTest: false });

        const a = new THREE.Mesh(handleGeom, handleMat);
        a.position.set(mirror.x1, y + 0.01, mirror.z1);
        a.renderOrder = 999;
        group.add(a);

        const b = new THREE.Mesh(handleGeom.clone(), handleMat.clone());
        b.position.set(mirror.x2, y + 0.01, mirror.z2);
        b.renderOrder = 999;
        group.add(b);

        group.userData = { mirrorId: mirror.id, line, handleA: a, handleB: b };
        return group;
    }

    _updateMirrorMesh(group, mirror, y) {
        const { line, handleA, handleB } = group.userData;
        const positions = line.geometry.attributes.position;
        positions.setXYZ(0, mirror.x1, y + 0.01, mirror.z1);
        positions.setXYZ(1, mirror.x2, y + 0.01, mirror.z2);
        positions.needsUpdate = true;
        line.geometry.computeBoundingSphere();

        handleA.position.set(mirror.x1, y + 0.01, mirror.z1);
        handleB.position.set(mirror.x2, y + 0.01, mirror.z2);
    }

    _disposeMirrorMesh(group) {
        group.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
        this.sceneManager.scene.remove(group);
    }

    clear() {
        for (const mesh of this.mirrorMeshes.values()) {
            this._disposeMirrorMesh(mesh);
        }
        this.mirrorMeshes.clear();
    }
}

export default MirrorManager;
