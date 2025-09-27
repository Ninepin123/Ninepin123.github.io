import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 狀態變數 ---
const particlePoints = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isDrawing = false;
let lastPointPosition = new THREE.Vector3();
const MIN_DISTANCE = 0.2;
let currentMode = 'camera'; // 'camera', 'point', 'brush', 'eraser'
let planeRotation = { x: 0, y: 0, z: 0 }; // 平面旋轉角度 (度)

// --- UI 元素 ---
const particleTypeSelect = document.querySelector('#particle-type');
const particleColorInput = document.querySelector('#particle-color');
const drawingHeightSlider = document.querySelector('#drawing-height');
const heightDisplay = document.querySelector('#height-display');
const planeRotationXSlider = document.querySelector('#plane-rotation-x');
const planeRotationYSlider = document.querySelector('#plane-rotation-y');
const planeRotationZSlider = document.querySelector('#plane-rotation-z');
const rotationXDisplay = document.querySelector('#rotation-x-display');
const rotationYDisplay = document.querySelector('#rotation-y-display');
const rotationZDisplay = document.querySelector('#rotation-z-display');
const generateBtn = document.querySelector('#btn-generate');
const clearBtn = document.querySelector('#btn-clear');
const undoBtn = document.querySelector('#btn-undo');
const codeOutput = document.querySelector('#code-output');
const cameraModeBtn = document.querySelector('#btn-mode-camera');
const pointModeBtn = document.querySelector('#btn-mode-point');
const brushModeBtn = document.querySelector('#btn-mode-brush');
const eraserModeBtn = document.querySelector('#btn-mode-eraser');
const modeButtons = [cameraModeBtn, pointModeBtn, brushModeBtn, eraserModeBtn];

// 專案管理相關UI元素
const newProjectBtn = document.querySelector('#btn-new-project');
const saveProjectBtn = document.querySelector('#btn-save-project');
const loadProjectBtn = document.querySelector('#btn-load-project');
const projectNameInput = document.querySelector('#project-name');
const currentProjectDisplay = document.querySelector('#current-project-display');

// 專案管理狀態
let currentProjectName = '未命名專案';
let hasUnsavedChanges = false;

// --- Three.js 核心初始化 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 8, 10);
camera.lookAt(0, 0, 0);
const canvas = document.querySelector('#scene-canvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 0, 0);
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);
const planeGeometry = new THREE.PlaneGeometry(10, 10);
planeGeometry.rotateX(-Math.PI / 2);
const targetPlane = new THREE.Mesh(planeGeometry, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
scene.add(targetPlane);

// 創建動態高度參考平面的幾何體
const dynamicPlaneGeometry = new THREE.PlaneGeometry(10, 10);
dynamicPlaneGeometry.rotateX(-Math.PI / 2);
const dynamicTargetPlane = new THREE.Mesh(dynamicPlaneGeometry, new THREE.MeshBasicMaterial({ 
    visible: false, 
    transparent: true,
    side: THREE.DoubleSide 
}));

// 創建視覺化的高度參考網格
const heightGridHelper = new THREE.GridHelper(10, 10, 0xff4444, 0xff6666);
heightGridHelper.material.transparent = true;
heightGridHelper.material.opacity = 0.5;
heightGridHelper.visible = false;
// 創建自定義顏色的坐標軸輔助器
// X軸: 橘色 (左右), Y軸: 綠色 (上下), Z軸: 藍色 (前後)
const axesGeometry = new THREE.BufferGeometry();
const axesPositions = [
    // X軸 (橘色 - 左右)
    0, 0, 0,  2, 0, 0,
    // Y軸 (綠色 - 上下) 
    0, 0, 0,  0, 2, 0,
    // Z軸 (藍色 - 前後)
    0, 0, 0,  0, 0, 2
];
const axesColors = [
    // X軸顏色 (橘色)
    1.0, 0.55, 0.0,  1.0, 0.55, 0.0,
    // Y軸顏色 (綠色)
    0.0, 0.8, 0.0,   0.0, 0.8, 0.0,
    // Z軸顏色 (藍色)
    0.0, 0.48, 1.0,  0.0, 0.48, 1.0
];
axesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(axesPositions, 3));
axesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(axesColors, 3));
const axesMaterial = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 3 });
const axesHelper = new THREE.LineSegments(axesGeometry, axesMaterial);
scene.add(axesHelper);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
directionalLight.position.set(10, 15, 20);
scene.add(directionalLight);

// --- 響應式視窗 ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
});

// --- 核心功能函式 ---

/**
 * 在指定座標點繪製粒子標記，並可選擇性地加入一個線段 Mesh
 * @param {THREE.Vector3} point - 要繪製的 3D 座標
 * @param {THREE.Line | null} lineSegment - 連接到上一個點的線段 Mesh
 */
function addPoint(point, lineSegment = null) {
    const particleType = particleTypeSelect.value;
    const particleColor = particleColorInput.value;
    const sphereGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: particleColor });
    const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphereMesh.position.copy(point);
    scene.add(sphereMesh);
    const newPointData = {
        x: point.x, y: point.y, z: point.z,
        particleType: particleType, color: particleColor,
        sphereMesh: sphereMesh,
        lineSegment: lineSegment
    };
    particlePoints.push(newPointData);
    markUnsavedChanges();
    updateConsoleLog();
}

/**
 * 擦除指定位置附近的粒子點
 * @param {THREE.Vector3} position - 擦除中心位置
 * @param {number} radius - 擦除半徑
 */
function eraseNearbyPoints(position, radius = 0.5) {
    const pointsToRemove = [];
    
    for (let i = particlePoints.length - 1; i >= 0; i--) {
        const point = particlePoints[i];
        const distance = position.distanceTo(new THREE.Vector3(point.x, point.y, point.z));
        
        if (distance <= radius) {
            pointsToRemove.push(i);
            // 從場景中移除球體
            if (point.sphereMesh) {
                scene.remove(point.sphereMesh);
            }
            // 從場景中移除線段
            if (point.lineSegment) {
                scene.remove(point.lineSegment);
            }
        }
    }
    
    // 從陣列中移除點 (從後往前移除避免索引問題)
    pointsToRemove.forEach(index => {
        particlePoints.splice(index, 1);
    });
    
    if (pointsToRemove.length > 0) {
        markUnsavedChanges();
        updateConsoleLog();
    }
}

/**
 * 使用射線檢測擦除直接碰到的粒子或附近的粒子
 * @param {MouseEvent} event - 滑鼠事件
 */
function eraseAtMousePosition(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    // 收集所有粒子球體用於射線檢測
    const particleMeshes = particlePoints.map(point => point.sphereMesh).filter(mesh => mesh);
    
    // 首先檢查是否直接命中任何粒子
    const intersects = raycaster.intersectObjects(particleMeshes);
    
    if (intersects.length > 0) {
        // 如果直接命中粒子，以該粒子為中心進行擦除
        const hitPosition = intersects[0].point;
        eraseNearbyPoints(hitPosition, 0.5);
    } else {
        // 如果沒有直接命中，嘗試與平面相交進行區域擦除
        const planeIntersect = getIntersectPoint(event);
        if (planeIntersect) {
            eraseNearbyPoints(planeIntersect, 0.5);
        }
    }
}

function updateConsoleLog() {
    console.clear();
    if (particlePoints.length > 0) {
        console.log("粒子資料列表：");
        console.table(particlePoints.map(p => ({
            x: p.x.toFixed(2), y: p.y.toFixed(2), z: p.z.toFixed(2), type: p.particleType, color: p.color
        })));
    } else {
        console.log('畫布已清除或沒有資料。');
    }
}

function getIntersectPoint(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    // 更新動態平面的高度
    const currentHeight = parseFloat(drawingHeightSlider.value);
    dynamicTargetPlane.position.y = currentHeight;
    
    // 當高度為0時使用預設的地面平面，否則使用動態高度平面
    const targetPlaneForIntersection = Math.abs(currentHeight) < 0.001 ? targetPlane : dynamicTargetPlane;
    
    // 確保 raycaster 可以檢測雙面平面的交點
    const intersects = raycaster.intersectObject(targetPlaneForIntersection, false);
    return intersects.length > 0 ? intersects[0].point : null;
}

function setMode(newMode) {
    currentMode = newMode;
    console.log("切換模式為:", newMode);
    modeButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`#btn-mode-${newMode}`).classList.add('active');
    controls.enabled = true;
    
    // 更新高度網格顯示
    updateHeightDisplay();
}

function updateColorPickerState() {
    const isColorSupported = particleTypeSelect.value === 'reddust';
    particleColorInput.disabled = !isColorSupported;
    particleColorInput.closest('.control-group').style.opacity = isColorSupported ? 1.0 : 0.5;
}

function updateHeightDisplay() {
    const height = parseFloat(drawingHeightSlider.value);
    heightDisplay.textContent = height.toFixed(1);
    
    // 更新動態平面位置
    dynamicTargetPlane.position.y = height;
    
    // 更新視覺化網格位置
    heightGridHelper.position.y = height;
    
    // 當高度大於0時顯示參考網格（包含相機模式）
    const shouldShowGrid = height > 0.05;
    heightGridHelper.visible = shouldShowGrid;
    
    console.log(`繪畫高度設定為: ${height}`);
}

function updatePlaneRotation() {
    // 取得旋轉角度並轉換為弧度
    planeRotation.x = parseFloat(planeRotationXSlider.value);
    planeRotation.y = parseFloat(planeRotationYSlider.value);
    planeRotation.z = parseFloat(planeRotationZSlider.value);
    
    const radX = (planeRotation.x * Math.PI) / 180;
    const radY = (planeRotation.y * Math.PI) / 180;
    const radZ = (planeRotation.z * Math.PI) / 180;
    
    // 更新顯示
    rotationXDisplay.textContent = `${planeRotation.x}°`;
    rotationYDisplay.textContent = `${planeRotation.y}°`;
    rotationZDisplay.textContent = `${planeRotation.z}°`;
    
    // 重設平面旋轉並應用新的旋轉
    dynamicTargetPlane.rotation.set(0, 0, 0);
    dynamicTargetPlane.rotateX(-Math.PI / 2); // 基本水平旋轉，讓平面保持水平
    dynamicTargetPlane.rotateX(radX);
    dynamicTargetPlane.rotateY(radY);
    dynamicTargetPlane.rotateZ(radZ);
    
    // 同步更新視覺化網格的旋轉，確保與動態平面完全一致
    heightGridHelper.rotation.set(0, 0, 0);
    heightGridHelper.rotateX(-Math.PI / 2); // 添加相同的基本水平旋轉
    heightGridHelper.rotateX(radX);
    heightGridHelper.rotateY(radY);
    heightGridHelper.rotateZ(radZ);
    
    console.log(`平面旋轉設定為: X=${planeRotation.x}°, Y=${planeRotation.y}°, Z=${planeRotation.z}°`);
}

// --- 專案管理功能 ---

function markUnsavedChanges() {
    hasUnsavedChanges = true;
    updateProjectDisplay();
}

function markSavedChanges() {
    hasUnsavedChanges = false;
    updateProjectDisplay();
}

function updateProjectDisplay() {
    const displayName = hasUnsavedChanges ? `${currentProjectName} *` : currentProjectName;
    currentProjectDisplay.textContent = displayName;
}

function getProjectData() {
    return {
        name: currentProjectName,
        createdAt: new Date().toISOString(),
        version: "1.0",
        particles: particlePoints.map(point => ({
            x: point.x,
            y: point.y,
            z: point.z,
            particleType: point.particleType,
            color: point.color
        })),
        settings: {
            drawingHeight: parseFloat(drawingHeightSlider.value),
            planeRotation: {
                x: planeRotation.x,
                y: planeRotation.y,
                z: planeRotation.z
            },
            particleType: particleTypeSelect.value,
            particleColor: particleColorInput.value
        }
    };
}

function loadProjectData(projectData) {
    try {
        // 清除現有內容
        clearProject();
        
        // 載入專案名稱
        currentProjectName = projectData.name || '未命名專案';
        projectNameInput.value = currentProjectName;
        
        // 載入設定
        if (projectData.settings) {
            drawingHeightSlider.value = projectData.settings.drawingHeight || 0;
            updateHeightDisplay();
            
            if (projectData.settings.planeRotation) {
                planeRotationXSlider.value = projectData.settings.planeRotation.x || 0;
                planeRotationYSlider.value = projectData.settings.planeRotation.y || 0;
                planeRotationZSlider.value = projectData.settings.planeRotation.z || 0;
                updatePlaneRotation();
            }
            
            particleTypeSelect.value = projectData.settings.particleType || 'flame';
            particleColorInput.value = projectData.settings.particleColor || '#ff0000';
            updateColorPickerState();
        }
        
        // 載入粒子點
        if (projectData.particles && Array.isArray(projectData.particles)) {
            projectData.particles.forEach(pointData => {
                const point = new THREE.Vector3(pointData.x, pointData.y, pointData.z);
                const sphereGeometry = new THREE.SphereGeometry(0.08, 16, 16);
                const sphereMaterial = new THREE.MeshBasicMaterial({ color: pointData.color });
                const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
                sphereMesh.position.copy(point);
                scene.add(sphereMesh);
                
                const newPointData = {
                    x: point.x, y: point.y, z: point.z,
                    particleType: pointData.particleType,
                    color: pointData.color,
                    sphereMesh: sphereMesh,
                    lineSegment: null
                };
                particlePoints.push(newPointData);
            });
        }
        
        markSavedChanges();
        updateConsoleLog();
        console.log(`專案 "${currentProjectName}" 載入成功！`);
        
    } catch (error) {
        console.error('載入專案時發生錯誤:', error);
        alert('載入專案時發生錯誤，請檢查檔案格式是否正確。');
    }
}

function clearProject() {
    // 清除所有粒子點和3D物件
    particlePoints.forEach(point => {
        scene.remove(point.sphereMesh);
        if (point.lineSegment) {
            scene.remove(point.lineSegment);
        }
    });
    particlePoints.length = 0;
    
    // 重設所有設定為預設值
    drawingHeightSlider.value = 0;
    planeRotationXSlider.value = 0;
    planeRotationYSlider.value = 0;
    planeRotationZSlider.value = 0;
    particleTypeSelect.value = 'flame';
    particleColorInput.value = '#ff0000';
    codeOutput.value = '';
    
    // 更新顯示
    updateHeightDisplay();
    updatePlaneRotation();
    updateColorPickerState();
    updateConsoleLog();
}

function newProject() {
    if (hasUnsavedChanges) {
        const shouldProceed = confirm('目前專案有未儲存的變更，確定要建立新專案嗎？未儲存的變更將會遺失。');
        if (!shouldProceed) return;
    }
    
    clearProject();
    currentProjectName = '未命名專案';
    projectNameInput.value = currentProjectName;
    markSavedChanges();
    console.log('已建立新專案');
}

function saveProject() {
    const name = projectNameInput.value.trim() || '未命名專案';
    currentProjectName = name;
    
    const projectData = getProjectData();
    const dataStr = JSON.stringify(projectData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${name}.mythic3d`;
    link.click();
    
    markSavedChanges();
    console.log(`專案 "${name}" 已儲存`);
}

function loadProject() {
    if (hasUnsavedChanges) {
        const shouldProceed = confirm('目前專案有未儲存的變更，確定要載入新專案嗎？未儲存的變更將會遺失。');
        if (!shouldProceed) return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mythic3d,.json';
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const projectData = JSON.parse(e.target.result);
                loadProjectData(projectData);
            } catch (error) {
                console.error('解析專案檔案時發生錯誤:', error);
                alert('無法讀取專案檔案，請確認檔案格式是否正確。');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// --- 動畫循環 ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// --- 事件監聽器 ---

// 模式切換事件
cameraModeBtn.addEventListener('click', () => setMode('camera'));
pointModeBtn.addEventListener('click', () => setMode('point'));
brushModeBtn.addEventListener('click', () => setMode('brush'));
eraserModeBtn.addEventListener('click', () => setMode('eraser'));

// 繪圖事件
canvas.addEventListener('mousedown', (event) => {
    if (currentMode === 'camera') return;
    isDrawing = true;
    controls.enabled = false;
    const intersectPoint = getIntersectPoint(event);
    if (intersectPoint) {
        if (currentMode === 'point') {
            addPoint(intersectPoint);
            isDrawing = false;
            controls.enabled = true;
        } else if (currentMode === 'brush') {
            addPoint(intersectPoint);
            lastPointPosition.copy(intersectPoint);
        } else if (currentMode === 'eraser') {
            eraseAtMousePosition(event);
        }
    }
});

canvas.addEventListener('mousemove', (event) => {
    if (!isDrawing) return;
    const currentPoint = getIntersectPoint(event);
    
    if (currentMode === 'brush') {
        if (currentPoint && currentPoint.distanceTo(lastPointPosition) > MIN_DISTANCE) {
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([lastPointPosition, currentPoint]);
            const lineMaterial = new THREE.LineBasicMaterial({ color: particleColorInput.value });
            const lineSegment = new THREE.Line(lineGeometry, lineMaterial);
            scene.add(lineSegment);
            addPoint(currentPoint, lineSegment);
            lastPointPosition.copy(currentPoint);
        }
    } else if (currentMode === 'eraser') {
        eraseAtMousePosition(event);
    }
});

window.addEventListener('mouseup', () => {
    isDrawing = false;
    controls.enabled = true;
});

// 功能按鈕事件
generateBtn.addEventListener('click', () => {
    if (particlePoints.length === 0) {
        codeOutput.value = "畫布上沒有任何粒子點，請先點擊繪製！";
        return;
    }
    const skillLines = ['MyDrawingSkill:', '  Skills:'];
    particlePoints.forEach(point => {
        const sideOffset = (-point.x).toFixed(3);
        const yOffset = point.y.toFixed(3);
        const forwardOffset = point.z.toFixed(3);
        let attributes = [
            `particle=${point.particleType}`, `amount=1`, `speed=0`,
            `y=${yOffset}`, `forwardOffset=${forwardOffset}`, `sideOffset=${sideOffset}`
        ];
        if (point.particleType === 'reddust') {
            attributes.push(`color=${point.color}`);
        }
        const attributesString = attributes.join(';');
        const line = `    - effect:particles{${attributesString}} @self`;
        skillLines.push(line);
    });
    codeOutput.value = skillLines.join('\n');
});

clearBtn.addEventListener('click', () => {
    if (particlePoints.length > 0) {
        const shouldProceed = confirm('確定要清除所有粒子點嗎？此操作無法復原。');
        if (!shouldProceed) return;
    }
    
    particlePoints.forEach(point => {
        scene.remove(point.sphereMesh);
        if (point.lineSegment) {
            scene.remove(point.lineSegment);
        }
    });
    particlePoints.length = 0;
    codeOutput.value = '';
    markUnsavedChanges();
    updateConsoleLog();
});

undoBtn.addEventListener('click', () => {
    const lastPoint = particlePoints.pop();
    if (lastPoint) {
        scene.remove(lastPoint.sphereMesh);
        if (lastPoint.lineSegment) {
            scene.remove(lastPoint.lineSegment);
        }
        codeOutput.value = '';
        markUnsavedChanges();
        updateConsoleLog();
    } else {
        console.log('沒有任何動作可以復原。');
    }
});

particleTypeSelect.addEventListener('change', updateColorPickerState);

// 高度控制事件
drawingHeightSlider.addEventListener('input', updateHeightDisplay);
drawingHeightSlider.addEventListener('change', updateHeightDisplay);

// 平面旋轉控制事件
planeRotationXSlider.addEventListener('input', updatePlaneRotation);
planeRotationXSlider.addEventListener('change', updatePlaneRotation);
planeRotationYSlider.addEventListener('input', updatePlaneRotation);
planeRotationYSlider.addEventListener('change', updatePlaneRotation);
planeRotationZSlider.addEventListener('input', updatePlaneRotation);
planeRotationZSlider.addEventListener('change', updatePlaneRotation);

// 專案管理事件
newProjectBtn.addEventListener('click', newProject);
saveProjectBtn.addEventListener('click', saveProject);
loadProjectBtn.addEventListener('click', loadProject);

// 專案名稱變更事件
projectNameInput.addEventListener('input', () => {
    markUnsavedChanges();
});

// --- 初始化 ---
setMode('camera');
updateColorPickerState();
updateHeightDisplay();
updatePlaneRotation();
updateProjectDisplay();
scene.add(dynamicTargetPlane);
scene.add(heightGridHelper);
console.log("MythicMobs 3D 繪圖器已成功初始化！支援 3D 高度繪畫和專案管理！");