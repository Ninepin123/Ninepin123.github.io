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

        // --- 攝影機設定 ---
        this.cameraSensitivitySlider = document.querySelector('#camera-sensitivity');
        this.sensitivityDisplay = document.querySelector('#sensitivity-display');

        this.generateBtn = document.querySelector('#btn-generate');
        this.copyCodeBtn = document.querySelector('#btn-copy-code'); // 新增複製按鈕的參照
        this.clearBtn = document.querySelector('#btn-clear');
        this.undoBtn = document.querySelector('#btn-undo');
        this.codeOutput = document.querySelector('#code-output');

        this.copyCodeBtn = document.querySelector('#btn-copy-code'); // 新增複製按鈕的參照
        this.clearBtn = document.querySelector('#btn-clear');
        this.undoBtn = document.querySelector('#btn-undo');
        this.codeOutput = document.querySelector('#code-output');

        // --- 浮動調色盤 ---
        this.floatingPalette = document.querySelector('#floating-palette');
        this.paletteHeader = document.querySelector('#palette-header'); // 新增標頭參照
        this.paletteSwatches = document.querySelector('#palette-swatches');

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

        // 攝影機靈敏度
        this.cameraSensitivitySlider.addEventListener('input', (e) => this.stateManager.setCameraSensitivity(parseFloat(e.target.value)));

        // 操作按鈕
        this.generateBtn.addEventListener('click', () => this.generateCode());
        this.copyCodeBtn.addEventListener('click', () => this.copyCode()); // 新增事件監聽器
        this.clearBtn.addEventListener('click', () => this.requestClear());
        this.undoBtn.addEventListener('click', () => this.stateManager.undoLastPoint());

        // 專案管理
        this.projectNameInput.addEventListener('input', (e) => this.stateManager.setProjectName(e.target.value));

        // 設定浮動調色盤可拖動
        this.setupPaletteDragging();

        // 使用事件委派處理調色盤點擊，這樣動態新增的元素也能響應
        this.paletteSwatches.addEventListener('click', (event) => {
            const swatch = event.target.closest('.color-swatch');
            if (swatch && swatch.dataset.color) {
                const clickedColor = swatch.dataset.color;
                // 我們可以直接呼叫狀態管理器來更新顏色
                // stateManager 會通知 UI 更新，包括更新 particleColorInput 的值
                this.stateManager.setParticleSettings('reddust', clickedColor);
            }
        });
    }

    setupPaletteDragging() {
        let isDragging = false;
        let offsetX, offsetY;

        const onMouseDown = (e) => {
            isDragging = true;
            // 計算滑鼠點擊位置相對於調色盤左上角的偏移
            offsetX = e.clientX - this.floatingPalette.offsetLeft;
            offsetY = e.clientY - this.floatingPalette.offsetTop;

            // 移除可能影響拖曳的 transition 效果
            this.floatingPalette.style.transition = 'none';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;

            // 計算調色盤的新位置
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;

            // 確保調色盤不會被拖出視窗外
            const paletteRect = this.floatingPalette.getBoundingClientRect();
            const bodyRect = document.body.getBoundingClientRect();

            if (newX < 0) newX = 0;
            if (newY < 0) newY = 0;
            if (newX + paletteRect.width > bodyRect.width) newX = bodyRect.width - paletteRect.width;
            if (newY + paletteRect.height > bodyRect.height) newY = bodyRect.height - paletteRect.height;


            this.floatingPalette.style.left = `${newX}px`;
            this.floatingPalette.style.top = `${newY}px`;

            // 拖曳時移除 bottom 和 transform 樣式，以 left/top 為主
            this.floatingPalette.style.bottom = 'auto';
            this.floatingPalette.style.transform = 'none';
        };

        const onMouseUp = () => {
            isDragging = false;
            // 恢復 transition 效果
            this.floatingPalette.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        this.paletteHeader.addEventListener('mousedown', onMouseDown);
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

        // 更新攝影機靈敏度顯示
        this.cameraSensitivitySlider.value = state.cameraSensitivity;
        this.sensitivityDisplay.textContent = state.cameraSensitivity.toFixed(1);

        // 更新專案顯示
        this.projectNameInput.value = state.currentProjectName;
        this.currentProjectDisplay.textContent = state.hasUnsavedChanges ? `${state.currentProjectName} *` : state.currentProjectName;

        // 清除程式碼輸出
        if (this.codeOutput.value) this.codeOutput.value = '';

        this.updateFloatingPalette(state);
    }

    updateFloatingPalette(state) {
        const isReddustMode = state.particleType === 'reddust';
        this.floatingPalette.classList.toggle('hidden', !isReddustMode);

        if (isReddustMode) {
            // 從粒子點中提取所有獨一無二的顏色
            const uniqueColors = [...new Set(state.particlePoints.map(p => p.color))];

            // 清除舊的顏色樣本
            this.paletteSwatches.innerHTML = '';

            if (uniqueColors.length === 0) {
                // 如果沒有顏色，可以顯示一則訊息
                this.paletteSwatches.textContent = '尚無顏色';
                return;
            }

            // 為每個獨一無二的顏色建立一個樣本
            uniqueColors.forEach(color => {
                const swatch = document.createElement('div');
                swatch.className = 'color-swatch';
                swatch.style.backgroundColor = color;
                swatch.dataset.color = color; // 將顏色儲存在 data 屬性中
                swatch.title = color;
                // 事件監聽器已移至 setupEventListeners 中，此處不再需要
                this.paletteSwatches.appendChild(swatch);
            });
        }
    }

    // --- 程式碼生成與複製 ---
    copyCode() {
        const code = this.codeOutput.value;
        if (!code || code === "畫布上沒有任何粒子點，請先點擊繪製！") {
            // 可選擇性地提供回饋，例如按鈕閃爍
            return;
        }

        navigator.clipboard.writeText(code).then(() => {
            const originalText = this.copyCodeBtn.textContent;
            this.copyCodeBtn.textContent = '已複製!';
            this.copyCodeBtn.style.backgroundColor = '#28a745'; // 綠色表示成功
            setTimeout(() => {
                this.copyCodeBtn.textContent = originalText;
                this.copyCodeBtn.style.backgroundColor = ''; // 恢復原色
            }, 1500);
        }).catch(err => {
            console.error('無法複製程式碼: ', err);
            alert('複製失敗，請手動複製。');
        });
    }

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