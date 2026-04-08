import * as THREE from 'three';

class ToolPreview {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.mesh = null;
    }

    show(position, mode, radius) {
        this.clear();

        const plane = this.sceneManager.dynamicTargetPlane;
        plane.updateMatrixWorld(true);
        const normal = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(plane.quaternion)
            .normalize();

        const color = mode === 'brush' ? 0x00ff00 : 0xff0000;
        const geometry = new THREE.CircleGeometry(radius, 32);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });

        const previewPosition = position.clone().add(normal.clone().multiplyScalar(0.02));
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(previewPosition);
        this.mesh.setRotationFromQuaternion(plane.quaternion);
        this.mesh.renderOrder = 998;
        this.sceneManager.scene.add(this.mesh);

        // 邊框線
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({
            color,
            linewidth: 2,
            depthTest: false
        });
        const line = new THREE.LineSegments(edgesGeometry, lineMaterial);
        line.position.copy(previewPosition);
        line.setRotationFromQuaternion(plane.quaternion);
        line.renderOrder = 999;
        this.sceneManager.scene.add(line);

        this.mesh.userData.edgeLine = line;
    }

    clear() {
        if (!this.mesh) return;
        if (this.mesh.userData.edgeLine) {
            const line = this.mesh.userData.edgeLine;
            this.sceneManager.scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        }
        this.sceneManager.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.mesh = null;
    }
}

export default ToolPreview;
