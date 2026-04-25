import * as THREE from 'three';
import DrawingGroup from './DrawingGroup.js';
import { reflectSingleParticle } from './ReflectionUtil.js';

class BrushTool {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.currentGroup = null;
        this.previewMeshes = [];
        this.MIN_DISTANCE = 0.2;
    }

    startStroke(intersectPoint, state) {
        const basePoint = {
            id: crypto.randomUUID(),
            x: intersectPoint.x, y: intersectPoint.y, z: intersectPoint.z,
            particleType: state.particleType, color: state.particleColor
        };

        const allPoints = reflectSingleParticle(basePoint, state.mirrors || []);

        this.currentGroup = new DrawingGroup({
            type: 'brush',
            particles: allPoints,
            particleType: state.particleType,
            color: state.particleColor,
            isAnimated: !!state.animationEnabled
        });

        for (const p of allPoints) {
            const previewMesh = this.sceneManager.addPoint({
                point: new THREE.Vector3(p.x, p.y, p.z),
                color: p.color,
                opacity: 0.5
            });
            this.previewMeshes.push(previewMesh);
        }

        return basePoint;
    }

    continueStroke(intersectPoint, state, lastPointPosition) {
        if (!this.currentGroup || !lastPointPosition) return null;

        const lastPos = new THREE.Vector3(lastPointPosition.x, lastPointPosition.y, lastPointPosition.z);
        if (intersectPoint.distanceTo(lastPos) <= this.MIN_DISTANCE) return null;

        const basePoint = {
            id: crypto.randomUUID(),
            x: intersectPoint.x, y: intersectPoint.y, z: intersectPoint.z,
            particleType: state.particleType, color: state.particleColor
        };

        const allPoints = reflectSingleParticle(basePoint, state.mirrors || []);

        for (const p of allPoints) {
            this.currentGroup.addParticle(p);
            const previewMesh = this.sceneManager.addPoint({
                point: new THREE.Vector3(p.x, p.y, p.z),
                color: p.color,
                opacity: 0.5
            });
            this.previewMeshes.push(previewMesh);
        }

        return basePoint;
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
