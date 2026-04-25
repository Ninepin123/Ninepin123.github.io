import * as THREE from 'three';
import DrawingGroup from './DrawingGroup.js';
import { reflectParticles } from './ReflectionUtil.js';

class ShapeTool {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.startPoint = null;
        this.previewMesh = null;
    }

    startShape(intersectPoint) {
        this.startPoint = intersectPoint.clone();
    }

    isActive() {
        return this.startPoint !== null;
    }

    updatePreview(endPoint, shapeType) {
        this.clearPreview();
        if (!this.startPoint) return;

        const { plane, normal, worldToPlane, planeToWorld } = this.sceneManager.getDrawingPlaneInfo();
        const startLocal = worldToPlane(this.startPoint);
        const endLocal = worldToPlane(endPoint);

        const sizeX = Math.abs(endLocal.x - startLocal.x);
        const sizeZ = Math.abs(endLocal.z - startLocal.z);

        let geometry = null;

        if (shapeType === 'rectangle') {
            if (sizeX < 0.1 || sizeZ < 0.1) return;
            geometry = new THREE.PlaneGeometry(sizeX, sizeZ).rotateX(-Math.PI / 2);
        } else if (shapeType === 'circle') {
            const radius = Math.sqrt(
                Math.pow(endLocal.x - startLocal.x, 2) +
                Math.pow(endLocal.z - startLocal.z, 2)
            ) / 2;
            if (sizeX < 0.1 || sizeZ < 0.1) return;
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

        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });

        this.previewMesh = new THREE.Mesh(geometry, material);
        this.previewMesh.position.copy(previewPosition);
        this.previewMesh.setRotationFromQuaternion(plane.quaternion);
        this.previewMesh.renderOrder = 999;
        this.sceneManager.scene.add(this.previewMesh);

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

        this.previewMesh.userData.edgeLine = line;
    }

    createShape(endPoint, shapeType, state) {
        if (!this.startPoint) return null;

        const particles = [];
        const spacing = 0.2;
        const { worldToPlane, planeToWorld } = this.sceneManager.getDrawingPlaneInfo();

        const startLocal = worldToPlane(this.startPoint);
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

        if (particles.length === 0) return null;

        const finalParticles = reflectParticles(particles, state.mirrors || []);

        this.startPoint = null;
        return new DrawingGroup({
            type: shapeType,
            particles: finalParticles,
            particleType: state.particleType,
            color: state.particleColor,
            isAnimated: !!state.animationEnabled
        });
    }

    clearPreview() {
        if (!this.previewMesh) return;
        if (this.previewMesh.userData.edgeLine) {
            const line = this.previewMesh.userData.edgeLine;
            this.sceneManager.scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        }
        this.sceneManager.scene.remove(this.previewMesh);
        this.previewMesh.geometry.dispose();
        this.previewMesh.material.dispose();
        this.previewMesh = null;
    }

    reset() {
        this.clearPreview();
        this.startPoint = null;
    }
}

export default ShapeTool;
