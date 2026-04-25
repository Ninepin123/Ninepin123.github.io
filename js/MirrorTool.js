import * as THREE from 'three';

/**
 * 鏡子放置工具：第一次點擊定起點，第二次點擊定終點，建立一面鏡子。
 * 移動滑鼠時顯示預覽線段。
 */
class MirrorTool {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.startPoint = null; // THREE.Vector3 or null
        this.previewLine = null;
    }

    isActive() {
        return this.startPoint !== null;
    }

    /**
     * 點擊處理：若尚未有起點，記下起點；否則完成鏡子。
     * @returns {Object|null} 完成時回傳 {x1, z1, x2, z2}；尚未完成回傳 null
     */
    handleClick(intersectPoint) {
        if (!this.startPoint) {
            this.startPoint = intersectPoint.clone();
            return null;
        }

        const x1 = this.startPoint.x;
        const z1 = this.startPoint.z;
        const x2 = intersectPoint.x;
        const z2 = intersectPoint.z;

        // 太短的鏡子忽略
        const dx = x2 - x1;
        const dz = z2 - z1;
        if (dx * dx + dz * dz < 0.04) {
            return null;
        }

        this.startPoint = null;
        this.clearPreview();
        return { x1, z1, x2, z2 };
    }

    updatePreview(currentPoint, drawingHeight) {
        if (!this.startPoint) return;
        this.clearPreview();

        const y = drawingHeight + 0.01;
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute([
            this.startPoint.x, y, this.startPoint.z,
            currentPoint.x, y, currentPoint.z
        ], 3));
        const mat = new THREE.LineDashedMaterial({
            color: 0x66ccff,
            dashSize: 0.2,
            gapSize: 0.1,
            transparent: true,
            opacity: 0.7,
            depthTest: false
        });
        const line = new THREE.Line(geom, mat);
        line.computeLineDistances();
        line.renderOrder = 1001;
        this.sceneManager.scene.add(line);
        this.previewLine = line;
    }

    clearPreview() {
        if (this.previewLine) {
            this.previewLine.geometry.dispose();
            this.previewLine.material.dispose();
            this.sceneManager.scene.remove(this.previewLine);
            this.previewLine = null;
        }
    }

    cancel() {
        this.startPoint = null;
        this.clearPreview();
    }
}

export default MirrorTool;
