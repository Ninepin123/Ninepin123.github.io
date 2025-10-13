import * as THREE from 'three';

/**
 * DrawingGroup - 繪圖群組類別
 * 管理一組粒子點，可以是自由繪製、方塊、圓形等
 */
class DrawingGroup {
    constructor(config) {
        this.id = config.id || crypto.randomUUID();
        this.type = config.type; // 'brush', 'rectangle', 'circle'
        this.particles = config.particles || [];
        this.particleType = config.particleType || 'flame';
        this.color = config.color || '#ff0000';

        // 邊界框
        this.bounds = config.bounds || this.calculateBounds();

        // 群組的中心位置
        this.position = config.position || this.calculateCenter();

        // 3D 物件引用
        this.meshes = []; // 粒子的 mesh
        this.boundingBox = null; // 邊界框 mesh
        this.resizeHandles = []; // 縮放控制點
        this.isSelected = false;

        // 創建時間
        this.createdAt = config.createdAt || Date.now();
    }

    /**
     * 計算群組的邊界
     */
    calculateBounds() {
        if (this.particles.length === 0) {
            return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
        }

        const bounds = {
            min: {
                x: Math.min(...this.particles.map(p => p.x)),
                y: Math.min(...this.particles.map(p => p.y)),
                z: Math.min(...this.particles.map(p => p.z))
            },
            max: {
                x: Math.max(...this.particles.map(p => p.x)),
                y: Math.max(...this.particles.map(p => p.y)),
                z: Math.max(...this.particles.map(p => p.z))
            }
        };

        return bounds;
    }

    /**
     * 計算群組的中心點
     */
    calculateCenter() {
        if (this.particles.length === 0) {
            return { x: 0, y: 0, z: 0 };
        }

        const center = {
            x: this.particles.reduce((sum, p) => sum + p.x, 0) / this.particles.length,
            y: this.particles.reduce((sum, p) => sum + p.y, 0) / this.particles.length,
            z: this.particles.reduce((sum, p) => sum + p.z, 0) / this.particles.length
        };

        return center;
    }

    /**
     * 添加粒子到群組
     */
    addParticle(particle) {
        this.particles.push(particle);
        this.bounds = this.calculateBounds();
        this.position = this.calculateCenter();
    }

    /**
     * 移動群組到新位置
     */
    moveTo(newPosition) {
        const offset = {
            x: newPosition.x - this.position.x,
            y: newPosition.y - this.position.y,
            z: newPosition.z - this.position.z
        };

        // 移動所有粒子
        this.particles.forEach(particle => {
            particle.x += offset.x;
            particle.y += offset.y;
            particle.z += offset.z;
        });

        // 更新位置和邊界
        this.position = newPosition;
        this.bounds = this.calculateBounds();
    }

    /**
     * 縮放群組
     */
    scale(scaleX, scaleY, scaleZ) {
        const center = this.position;

        // 相對於中心點縮放每個粒子
        this.particles.forEach(particle => {
            particle.x = center.x + (particle.x - center.x) * scaleX;
            particle.y = center.y + (particle.y - center.y) * scaleY;
            particle.z = center.z + (particle.z - center.z) * scaleZ;
        });

        // 更新邊界
        this.bounds = this.calculateBounds();
    }

    /**
     * 檢查點是否在群組邊界內
     */
    containsPoint(point, tolerance = 0.1) {
        return (
            point.x >= this.bounds.min.x - tolerance &&
            point.x <= this.bounds.max.x + tolerance &&
            point.y >= this.bounds.min.y - tolerance &&
            point.y <= this.bounds.max.y + tolerance &&
            point.z >= this.bounds.min.z - tolerance &&
            point.z <= this.bounds.max.z + tolerance
        );
    }

    /**
     * 創建邊界框視覺物件
     */
    createBoundingBoxMesh() {
        const width = this.bounds.max.x - this.bounds.min.x;
        const height = this.bounds.max.y - this.bounds.min.y;
        const depth = this.bounds.max.z - this.bounds.min.z;

        const geometry = new THREE.BoxGeometry(
            Math.max(width, 0.1),
            Math.max(height, 0.1),
            Math.max(depth, 0.1)
        );

        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            transparent: true,
            opacity: 0.8
        });

        const boundingBox = new THREE.LineSegments(edges, material);
        boundingBox.position.set(
            (this.bounds.min.x + this.bounds.max.x) / 2,
            (this.bounds.min.y + this.bounds.max.y) / 2,
            (this.bounds.min.z + this.bounds.max.z) / 2
        );

        this.boundingBox = boundingBox;
        return boundingBox;
    }

    /**
     * 創建縮放控制點
     */
    createResizeHandles() {
        const handles = [];
        const handleSize = 0.15;
        const geometry = new THREE.SphereGeometry(handleSize, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xff9900 });

        // 8個角的控制點
        const corners = [
            [this.bounds.min.x, this.bounds.min.y, this.bounds.min.z],
            [this.bounds.max.x, this.bounds.min.y, this.bounds.min.z],
            [this.bounds.min.x, this.bounds.max.y, this.bounds.min.z],
            [this.bounds.max.x, this.bounds.max.y, this.bounds.min.z],
            [this.bounds.min.x, this.bounds.min.y, this.bounds.max.z],
            [this.bounds.max.x, this.bounds.min.y, this.bounds.max.z],
            [this.bounds.min.x, this.bounds.max.y, this.bounds.max.z],
            [this.bounds.max.x, this.bounds.max.y, this.bounds.max.z]
        ];

        corners.forEach((corner, index) => {
            const handle = new THREE.Mesh(geometry.clone(), material.clone());
            handle.position.set(corner[0], corner[1], corner[2]);
            handle.userData = {
                type: 'resizeHandle',
                groupId: this.id,
                handleIndex: index
            };
            handles.push(handle);
        });

        this.resizeHandles = handles;
        return handles;
    }

    /**
     * 顯示選中狀態
     */
    showSelection(scene) {
        this.isSelected = true;

        // 創建並添加邊界框
        if (!this.boundingBox) {
            this.createBoundingBoxMesh();
        }
        scene.add(this.boundingBox);

        // 創建並添加縮放控制點
        if (this.resizeHandles.length === 0) {
            this.createResizeHandles();
        }
        this.resizeHandles.forEach(handle => scene.add(handle));
    }

    /**
     * 隱藏選中狀態
     */
    hideSelection(scene) {
        this.isSelected = false;

        // 移除邊界框
        if (this.boundingBox) {
            scene.remove(this.boundingBox);
        }

        // 移除縮放控制點
        this.resizeHandles.forEach(handle => scene.remove(handle));
    }

    /**
     * 更新視覺物件位置
     */
    updateVisuals(scene) {
        if (this.isSelected) {
            // 移除舊的視覺物件
            this.hideSelection(scene);

            // 重新創建
            this.boundingBox = null;
            this.resizeHandles = [];

            // 顯示新的
            this.showSelection(scene);
        }
    }

    /**
     * 序列化為可儲存的格式
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            particles: this.particles.map(p => ({
                id: p.id,
                x: p.x,
                y: p.y,
                z: p.z,
                particleType: p.particleType || this.particleType,
                color: p.color || this.color
            })),
            particleType: this.particleType,
            color: this.color,
            bounds: this.bounds,
            position: this.position,
            createdAt: this.createdAt
        };
    }

    /**
     * 從 JSON 創建群組
     */
    static fromJSON(json) {
        return new DrawingGroup({
            id: json.id,
            type: json.type,
            particles: json.particles || [],
            particleType: json.particleType,
            color: json.color,
            bounds: json.bounds,
            position: json.position,
            createdAt: json.createdAt
        });
    }

    /**
     * 清理資源
     */
    dispose(scene) {
        // 移除視覺元素
        this.hideSelection(scene);

        // 清理 bounding box
        if (this.boundingBox) {
            if (this.boundingBox.geometry) this.boundingBox.geometry.dispose();
            if (this.boundingBox.material) this.boundingBox.material.dispose();
            scene.remove(this.boundingBox);
            this.boundingBox = null;
        }

        // 清理 resize handles
        this.resizeHandles.forEach(handle => {
            if (handle.geometry) handle.geometry.dispose();
            if (handle.material) handle.material.dispose();
            scene.remove(handle);
        });
        this.resizeHandles = [];

        // 清理粒子的 mesh
        this.meshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            scene.remove(mesh);
        });

        this.meshes = [];
    }
}

export default DrawingGroup;
