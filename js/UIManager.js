class UIManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.initDOMElements();
        this.setupEventListeners();
        this.stateManager.subscribe(this.updateUI.bind(this));
    }

    initDOMElements() {
        // --- UI 元素 ---
        this.particleTypeSelect = document.querySelector('#particle-type');
        this.particleColorInput = document.querySelector('#particle-color');
        this.drawingHeightSlider = document.querySelector('#drawing-height');
        this.heightDisplay = document.querySelector('#height-display');
        this.planeRotationXSlider = document.querySelector('#plane-rotation-x');
        this.planeRotationYSlider = document.querySelector('#plane-rotation-y');
        this.planeRotationZSlider = document.querySelector('#plane-rotation-z');
        this.rotationXDisplay = document.querySelector('#rotation-x-display');
        this.rotationYDisplay = document.querySelector('#rotation-y-display');
        this.rotationZDisplay = document.querySelector('#rotation-z-display');
        this.generateBtn = document.querySelector('#btn-generate');
        this.clearBtn = document.querySelector('#btn-clear');
        this.undoBtn = document.querySelector('#btn-undo');
        this.codeOutput = document.querySelector('#code-output');

        // --- 模式按鈕 ---
        this.modeButtons = {
            camera: document.querySelector('#btn-mode-camera'),
            point: document.querySelector('#btn-mode-point'),
            brush: document.querySelector('#btn-mode-brush'),
            eraser: document.querySelector('#btn-mode-eraser'),
        };

        // --- 專案管理 ---
        this.newProjectBtn = document.querySelector('#btn-new-project');
        this.saveProjectBtn = document.querySelector('#btn-save-project');
        this.loadProjectBtn = document.querySelector('#btn-load-project');
        this.projectNameInput = document.querySelector('#project-name');
        this.currentProjectDisplay = document.querySelector('#current-project-display');
    }

    setupEventListeners() {
        // 模式切換
        Object.entries(this.modeButtons).forEach(([mode, button]) => {
            button.addEventListener('click', () => this.stateManager.setMode(mode));
        });

        // 粒子設定
        this.particleTypeSelect.addEventListener('change', () => this.handleParticleSettingsChange());
        this.particleColorInput.addEventListener('input', () => this.handleParticleSettingsChange());

        // 繪圖設定
        this.drawingHeightSlider.addEventListener('input', (e) => this.stateManager.setDrawingHeight(parseFloat(e.target.value)));

        // 平面旋轉
        this.planeRotationXSlider.addEventListener('input', () => this.handlePlaneRotationChange());
        this.planeRotationYSlider.addEventListener('input', () => this.handlePlaneRotationChange());
        this.planeRotationZSlider.addEventListener('input', () => this.handlePlaneRotationChange());

        // 操作按鈕
        this.generateBtn.addEventListener('click', () => this.generateCode());
        this.clearBtn.addEventListener('click', () => this.requestClear());
        this.undoBtn.addEventListener('click', () => this.stateManager.undoLastPoint());

        // 專案管理
        this.projectNameInput.addEventListener('input', (e) => this.stateManager.setProjectName(e.target.value));
    }

    // --- 事件處理函式 ---
    handleParticleSettingsChange() {
        const type = this.particleTypeSelect.value;
        const color = this.particleColorInput.value;
        this.stateManager.setParticleSettings(type, color);
    }

    handlePlaneRotationChange() {
        const rotation = {
            x: parseFloat(this.planeRotationXSlider.value),
            y: parseFloat(this.planeRotationYSlider.value),
            z: parseFloat(this.planeRotationZSlider.value),
        };
        this.stateManager.setPlaneRotation(rotation);
    }

    requestClear() {
        if (this.stateManager.getState().particlePoints.length > 0) {
            if (confirm('確定要清除所有粒子點嗎？此操作無法復原。')) {
                this.stateManager.clearPoints();
            }
        }
    }

    // --- UI 更新 ---
    updateUI(state) {
        // 更新模式按鈕
        Object.entries(this.modeButtons).forEach(([mode, button]) => {
            button.classList.toggle('active', mode === state.currentMode);
        });

        // 更新粒子設定
        this.particleTypeSelect.value = state.particleType;
        this.particleColorInput.value = state.particleColor;
        const isColorSupported = state.particleType === 'reddust';
        this.particleColorInput.disabled = !isColorSupported;
        this.particleColorInput.closest('.control-group').style.opacity = isColorSupported ? 1.0 : 0.5;

        // 更新繪圖高度
        this.drawingHeightSlider.value = state.drawingHeight;
        this.heightDisplay.textContent = state.drawingHeight.toFixed(1);

        // 更新平面旋轉
        this.planeRotationXSlider.value = state.planeRotation.x;
        this.rotationXDisplay.textContent = `${state.planeRotation.x}°`;
        this.planeRotationYSlider.value = state.planeRotation.y;
        this.rotationYDisplay.textContent = `${state.planeRotation.y}°`;
        this.planeRotationZSlider.value = state.planeRotation.z;
        this.rotationZDisplay.textContent = `${state.planeRotation.z}°`;

        // 更新專案顯示
        this.projectNameInput.value = state.currentProjectName;
        this.currentProjectDisplay.textContent = state.hasUnsavedChanges ? `${state.currentProjectName} *` : state.currentProjectName;

        // 清除程式碼輸出
        if (this.codeOutput.value) this.codeOutput.value = '';
    }

    // --- 程式碼生成 ---
    generateCode() {
        const state = this.stateManager.getState();
        if (state.particlePoints.length === 0) {
            this.codeOutput.value = "畫布上沒有任何粒子點，請先點擊繪製！";
            return;
        }
        const skillLines = ['MyDrawingSkill:', '  Skills:'];
        state.particlePoints.forEach(point => {
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
        this.codeOutput.value = skillLines.join('\n');
    }

    // 將專案管理按鈕的事件監聽器與 ProjectManager 連接
    bindProjectManager(projectManager) {
        this.newProjectBtn.addEventListener('click', () => projectManager.newProject());
        this.saveProjectBtn.addEventListener('click', () => projectManager.saveProject());
        this.loadProjectBtn.addEventListener('click', () => projectManager.loadProject());
    }
}

export default UIManager;