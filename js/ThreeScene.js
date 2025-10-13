import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class ThreeScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.particlePoints = [];
        this.gridSize = 10; // 預設網格大小
        this.init();
    }

    init() {
        // --- Three.js 核心初始化 ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(5, 8, 10);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = false; // 停用阻尼以獲得更即時的反應
        this.controls.target.set(0, 0, 0);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.setupSceneElements();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupSceneElements() {
        // 網格輔助
        this.gridHelper = new THREE.GridHelper(this.gridSize, this.gridSize);
        this.scene.add(this.gridHelper);

        // 坐標軸輔助
        const axesGeometry = new THREE.BufferGeometry();
        const axesPositions = [0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 2];
        const axesColors = [1.0, 0.55, 0.0, 1.0, 0.55, 0.0, 0.0, 0.8, 0.0, 0.0, 0.8, 0.0, 0.0, 0.48, 1.0, 0.0, 0.48, 1.0];
        axesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(axesPositions, 3));
        axesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(axesColors, 3));
        const axesMaterial = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 3 });
        const axesHelper = new THREE.LineSegments(axesGeometry, axesMaterial);
        this.scene.add(axesHelper);

        // 光源
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(10, 15, 20);
        this.scene.add(directionalLight);

        // 繪圖目標平面
        this.targetPlane = new THREE.Mesh(new THREE.PlaneGeometry(this.gridSize, this.gridSize).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        this.scene.add(this.targetPlane);

        this.dynamicTargetPlane = new THREE.Mesh(new THREE.PlaneGeometry(this.gridSize, this.gridSize).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false, transparent: true, side: THREE.DoubleSide }));
        this.scene.add(this.dynamicTargetPlane);

        this.heightGridHelper = new THREE.GridHelper(this.gridSize, this.gridSize, 0xff4444, 0xff6666);
        this.heightGridHelper.material.transparent = true;
        this.heightGridHelper.material.opacity = 0.5;
        this.heightGridHelper.visible = false;
        this.scene.add(this.heightGridHelper);
    }

    addPoint(pointData) {
        const { point, color, particleType } = pointData;
        const sphereGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: color });
        const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphereMesh.position.copy(point);
        this.scene.add(sphereMesh);
        return sphereMesh;
    }

    removeObject(object) {
        if (object) {
            this.scene.remove(object);
        }
    }

    getIntersectPoint(event, drawingHeight, planeRotation) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        this.dynamicTargetPlane.position.y = drawingHeight;
        this.updatePlaneRotation(planeRotation);

        const target = Math.abs(drawingHeight) < 0.001 ? this.targetPlane : this.dynamicTargetPlane;
        const intersects = this.raycaster.intersectObject(target, false);
        return intersects.length > 0 ? intersects[0].point : null;
    }

    updatePlaneRotation(rotation) {
        const radX = (rotation.x * Math.PI) / 180;
        const radY = (rotation.y * Math.PI) / 180;
        const radZ = (rotation.z * Math.PI) / 180;

        this.dynamicTargetPlane.rotation.set(-Math.PI / 2, 0, 0);
        this.dynamicTargetPlane.rotateX(radX);
        this.dynamicTargetPlane.rotateY(radY);
        this.dynamicTargetPlane.rotateZ(radZ);

        this.heightGridHelper.rotation.copy(this.dynamicTargetPlane.rotation);
    }

    updateHeight(height) {
        this.dynamicTargetPlane.position.y = height;
        this.heightGridHelper.position.y = height;
        this.heightGridHelper.visible = height > 0.05;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        // 當 enableDamping 為 false 時，不再需要在每一幀都呼叫 controls.update()
        // this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    updateCameraSensitivity(sensitivity) {
        this.controls.rotateSpeed = sensitivity;
        this.controls.zoomSpeed = sensitivity;
        this.controls.panSpeed = sensitivity;
    }

    updateGridSize(size) {
        this.gridSize = size;

        // 移除舊的網格
        this.scene.remove(this.gridHelper);
        this.scene.remove(this.targetPlane);
        this.scene.remove(this.dynamicTargetPlane);
        this.scene.remove(this.heightGridHelper);

        // 創建新的網格
        this.gridHelper = new THREE.GridHelper(size, size);
        this.scene.add(this.gridHelper);

        // 重新創建平面
        this.targetPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
        );
        this.scene.add(this.targetPlane);

        this.dynamicTargetPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ visible: false, transparent: true, side: THREE.DoubleSide })
        );
        this.scene.add(this.dynamicTargetPlane);

        this.heightGridHelper = new THREE.GridHelper(size, size, 0xff4444, 0xff6666);
        this.heightGridHelper.material.transparent = true;
        this.heightGridHelper.material.opacity = 0.5;
        this.heightGridHelper.visible = false;
        this.scene.add(this.heightGridHelper);
    }
}

export default ThreeScene;