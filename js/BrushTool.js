import * as THREE from 'three';
import DrawingGroup from './DrawingGroup.js';

class BrushTool {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.currentGroup = null;
        this.previewMeshes = [];
        this.MIN_DISTANCE = 0.2;
    }

    startStroke(intersectPoint, state) {
        const pointData = {
            id: crypto.randomUUID(),
            x: intersectPoint.x, y: intersectPoint.y, z: intersectPoint.z,
            particleType: state.particleType, color: state.particleColor
        };

        this.currentGroup = new DrawingGroup({
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
        this.previewMeshes.push(previewMesh);

        return pointData;
    }

    continueStroke(intersectPoint, state, lastPointPosition) {
        if (!this.currentGroup || !lastPointPosition) return null;

        const lastPos = new THREE.Vector3(lastPointPosition.x, lastPointPosition.y, lastPointPosition.z);
        if (intersectPoint.distanceTo(lastPos) <= this.MIN_DISTANCE) return null;

        const pointData = {
            id: crypto.randomUUID(),
            x: intersectPoint.x, y: intersectPoint.y, z: intersectPoint.z,
            particleType: state.particleType, color: state.particleColor
        };

        this.currentGroup.addParticle(pointData);

        const pointVec = new THREE.Vector3(pointData.x, pointData.y, pointData.z);
        const previewMesh = this.sceneManager.addPoint({
            point: pointVec,
            color: state.particleColor,
            opacity: 0.5
        });
        this.previewMeshes.push(previewMesh);

        return pointData;
    }

    finishStroke() {
        // 移除預覽 meshes
        this.previewMeshes.forEach(mesh => {
            this.sceneManager.removeObject(mesh);
        });
        this.previewMeshes = [];

        const group = this.currentGroup;
        this.currentGroup = null;
        return group && group.particles.length > 0 ? group : null;
    }

    cancelStroke() {
        this.previewMeshes.forEach(mesh => {
            this.sceneManager.removeObject(mesh);
        });
        this.previewMeshes = [];
        this.currentGroup = null;
    }

    cleanup() {
        this.cancelStroke();
    }
}

export default BrushTool;
