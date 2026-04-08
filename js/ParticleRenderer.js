import * as THREE from 'three';

const GEOMETRY = new THREE.SphereGeometry(0.08, 16, 16);
const INITIAL_CAPACITY = 256;
const GROW_FACTOR = 2;

class ParticleRenderer {
    constructor(scene) {
        this.scene = scene;
        this.meshesByColor = new Map();
        this.particleMap = new Map();
        this.nextId = 0;
    }

    _getOrCreateColorMesh(color) {
        if (this.meshesByColor.has(color)) {
            return this.meshesByColor.get(color);
        }

        const material = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.InstancedMesh(GEOMETRY, material, INITIAL_CAPACITY);
        mesh.count = 0;
        mesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < INITIAL_CAPACITY; i++) {
            dummy.position.set(0, 0, 0);
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;

        this.scene.add(mesh);
        const entry = {
            mesh,
            material,
            capacity: INITIAL_CAPACITY,
            freeIndices: [],
            particleIds: []
        };
        this.meshesByColor.set(color, entry);
        return entry;
    }

    _growCapacity(entry) {
        const oldCapacity = entry.capacity;
        const newCapacity = oldCapacity * GROW_FACTOR;

        const newMesh = new THREE.InstancedMesh(GEOMETRY, entry.material, newCapacity);
        newMesh.count = entry.mesh.count;
        newMesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < oldCapacity; i++) {
            const mat = new THREE.Matrix4();
            entry.mesh.getMatrixAt(i, mat);
            newMesh.setMatrixAt(i, mat);
        }
        for (let i = oldCapacity; i < newCapacity; i++) {
            dummy.position.set(0, 0, 0);
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            newMesh.setMatrixAt(i, dummy.matrix);
        }
        newMesh.instanceMatrix.needsUpdate = true;

        this.scene.remove(entry.mesh);
        entry.mesh.dispose();

        entry.mesh = newMesh;
        entry.capacity = newCapacity;
        this.scene.add(entry.mesh);
    }

    addParticle(particleId, position, color) {
        if (this.particleMap.has(particleId)) {
            this.updateParticlePosition(particleId, position);
            this.updateParticleColor(particleId, color);
            return;
        }

        const entry = this._getOrCreateColorMesh(color);
        let index;

        if (entry.freeIndices.length > 0) {
            index = entry.freeIndices.pop();
        } else {
            if (entry.mesh.count >= entry.capacity) {
                this._growCapacity(entry);
            }
            index = entry.mesh.count;
            entry.mesh.count++;
        }

        if (index >= entry.particleIds.length) {
            entry.particleIds.length = index + 1;
        }
        entry.particleIds[index] = particleId;

        const dummy = new THREE.Object3D();
        dummy.position.copy(position);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        entry.mesh.setMatrixAt(index, dummy.matrix);
        entry.mesh.instanceMatrix.needsUpdate = true;

        this.particleMap.set(particleId, {
            color,
            index,
            position: position.clone()
        });
    }

    removeParticle(particleId) {
        const info = this.particleMap.get(particleId);
        if (!info) return;

        const entry = this.meshesByColor.get(info.color);
        if (!entry) {
            this.particleMap.delete(particleId);
            return;
        }

        const lastUsedIndex = entry.mesh.count - 1;

        if (info.index === lastUsedIndex) {
            entry.particleIds[info.index] = undefined;
        } else {
            const swapId = entry.particleIds[lastUsedIndex];
            if (swapId) {
                const swapMat = new THREE.Matrix4();
                entry.mesh.getMatrixAt(lastUsedIndex, swapMat);
                entry.mesh.setMatrixAt(info.index, swapMat);
                entry.particleIds[info.index] = swapId;

                const swapInfo = this.particleMap.get(swapId);
                if (swapInfo) {
                    swapInfo.index = info.index;
                }
            }
            entry.particleIds[lastUsedIndex] = undefined;
        }

        const dummy = new THREE.Object3D();
        dummy.position.set(0, 0, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        entry.mesh.setMatrixAt(lastUsedIndex, dummy.matrix);

        entry.mesh.count--;
        entry.freeIndices.push(lastUsedIndex);
        entry.mesh.instanceMatrix.needsUpdate = true;

        this.particleMap.delete(particleId);

        if (entry.mesh.count === 0 && this.meshesByColor.size > 1) {
            this.scene.remove(entry.mesh);
            entry.mesh.dispose();
            entry.material.dispose();
            this.meshesByColor.delete(info.color);
        }
    }

    updateParticlePosition(particleId, position) {
        const info = this.particleMap.get(particleId);
        if (!info) return;

        info.position.copy(position);
        const entry = this.meshesByColor.get(info.color);
        if (!entry) return;

        const dummy = new THREE.Object3D();
        dummy.position.copy(position);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        entry.mesh.setMatrixAt(info.index, dummy.matrix);
        entry.mesh.instanceMatrix.needsUpdate = true;
    }

    updateParticleColor(particleId, newColor) {
        const info = this.particleMap.get(particleId);
        if (!info || info.color === newColor) return;

        const position = info.position.clone();
        this.removeParticle(particleId);
        this.addParticle(particleId, position, newColor);
    }

    getParticlePosition(particleId) {
        const info = this.particleMap.get(particleId);
        return info ? info.position.clone() : null;
    }

    hasParticle(particleId) {
        return this.particleMap.has(particleId);
    }

    raycast(raycaster) {
        const results = [];

        for (const [color, entry] of this.meshesByColor) {
            const intersects = raycaster.intersectObject(entry.mesh, false);
            for (const intersect of intersects) {
                const instanceId = intersect.instanceId;
                if (instanceId !== undefined && instanceId < entry.particleIds.length) {
                    const particleId = entry.particleIds[instanceId];
                    if (particleId) {
                        results.push({
                            particleId,
                            point: intersect.point,
                            color,
                            distance: intersect.distance
                        });
                    }
                }
            }
        }

        results.sort((a, b) => a.distance - b.distance);
        return results;
    }

    getAllParticlePositions() {
        const positions = new Map();
        for (const [id, info] of this.particleMap) {
            positions.set(id, info.position.clone());
        }
        return positions;
    }

    clear() {
        for (const [color, entry] of this.meshesByColor) {
            this.scene.remove(entry.mesh);
            entry.mesh.dispose();
            entry.material.dispose();
        }
        this.meshesByColor.clear();
        this.particleMap.clear();
    }

    getParticleCount() {
        return this.particleMap.size;
    }

    dispose() {
        this.clear();
    }
}

export default ParticleRenderer;
