import FloatingPalette from './FloatingPalette.js';
import CodeGenerator from './CodeGenerator.js';
import InlineEditor from './InlineEditor.js';

class UIManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.initDOMElements();
        this.setupSubModules();
        this.setupEventListeners();
        this.setupCollapsibleSections();
        this.setupPanelToggle();
        this.stateManager.subscribe(this.updateUI.bind(this));
    }

    setupSubModules() {
        this.floatingPalette = new FloatingPalette(this.stateManager, this.particleColorInput);
        this.codeGenerator = new CodeGenerator(this.stateManager, this.codeOutput, this.copyCodeBtn);
        this.inlineEditor = new InlineEditor(this.stateManager, this);
        this.inlineEditor.setup();
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

        this.planeOffsetXSlider = document.querySelector('#plane-offset-x');
        this.planeOffsetZSlider = document.querySelector('#plane-offset-z');
        this.offsetXDisplay = document.querySelector('#offset-x-display');
        this.offsetZDisplay = document.querySelector('#offset-z-display');

        // --- 場景設定 ---
        this.gridSizeSlider = document.querySelector('#grid-size');
        this.gridSizeDisplay = document.querySelector('#grid-size-display');
        this.cameraSensitivitySlider = document.querySelector('#camera-sensitivity');
        this.sensitivityDisplay = document.querySelector('#sensitivity-display');

        this.generateBtn = document.querySelector('#btn-generate');
        this.copyCodeBtn = document.querySelector('#btn-copy-code');
        this.clearBtn = document.querySelector('#btn-clear');
        this.undoBtn = document.querySelector('#btn-undo');
        this.codeOutput = document.querySelector('#code-output');

        // --- 模式按鈕 ---
        this.modeButtons = {
            camera: document.querySelector('#btn-mode-camera'),
            select: document.querySelector('#btn-mode-select'),
            point: document.querySelector('#btn-mode-point'),
            brush: document.querySelector('#btn-mode-brush'),
            eraser: document.querySelector('#btn-mode-eraser'),
            rectangle: document.querySelector('#btn-mode-rectangle'),
            circle: document.querySelector('#btn-mode-circle'),
        };

        // --- 橡皮擦模式按鈕 ---
        this.eraserModeButtons = {
            point: document.querySelector('#btn-eraser-mode-point'),
            group: document.querySelector('#btn-eraser-mode-group'),
        };
        this.eraserModeGroup = document.querySelector('#eraser-mode-group');

        // --- 形狀填充模式按鈕 ---
        this.shapeFillModeButtons = {
            filled: document.querySelector('#btn-shape-fill-filled'),
            outline: document.querySelector('#btn-shape-fill-outline'),
        };
        this.shapeFillModeGroup = document.querySelector('#shape-fill-mode-group');

        // --- 專案管理 ---
        this.newProjectBtn = document.querySelector('#btn-new-project');
        this.saveProjectBtn = document.querySelector('#btn-save-project');
        this.loadProjectBtn = document.querySelector('#btn-load-project');
        this.projectNameInput = document.querySelector('#project-name');
        this.skillIdInput = document.querySelector('#skill-id');
        this.currentProjectDisplay = document.querySelector('#current-project-display');

        // --- 面板切換 ---
        this.uiPanel = document.querySelector('#ui-panel');
        this.panelCloseBtn = document.querySelector('#panel-close-btn');
        this.panelOpenBtn = document.querySelector('#panel-open-btn');
    }

    setupEventListeners() {
        // 模式切換
        Object.entries(this.modeButtons).forEach(([mode, button]) => {
            button.addEventListener('click', () => this.stateManager.setMode(mode));
        });

        // 橡皮擦模式切換
        Object.entries(this.eraserModeButtons).forEach(([mode, button]) => {
            button.addEventListener('click', () => this.stateManager.setEraserMode(mode));
        });

        // 形狀填充模式切換
        Object.entries(this.shapeFillModeButtons).forEach(([mode, button]) => {
            button.addEventListener('click', () => this.stateManager.setShapeFillMode(mode));
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

        // 平面偏移
        this.planeOffsetXSlider.addEventListener('input', () => this.handlePlaneOffsetChange());
        this.planeOffsetZSlider.addEventListener('input', () => this.handlePlaneOffsetChange());

        // 場景設定
        this.gridSizeSlider.addEventListener('input', (e) => this.stateManager.setGridSize(parseInt(e.target.value)));
        this.cameraSensitivitySlider.addEventListener('input', (e) => this.stateManager.setCameraSensitivity(parseFloat(e.target.value)));

        // 操作按鈕
        this.generateBtn.addEventListener('click', () => this.codeGenerator.generate());
        this.copyCodeBtn.addEventListener('click', () => this.codeGenerator.copy());
        this.clearBtn.addEventListener('click', () => this.requestClear());
        this.undoBtn.addEventListener('click', () => this.stateManager.undoLastPoint());

        // 專案管理
        this.projectNameInput.addEventListener('input', (e) => this.stateManager.setProjectName(e.target.value));
        this.skillIdInput.addEventListener('input', (e) => this.stateManager.setSkillId(e.target.value));
    }

    // --- 可折疊區塊 ---
    setupCollapsibleSections() {
        const sections = document.querySelectorAll('.section');
        const savedState = this._loadCollapseState();

        sections.forEach(section => {
            const key = section.dataset.section;
            // Restore saved state (true = collapsed)
            if (savedState[key] === true) {
                section.classList.add('collapsed');
                const arrow = section.querySelector('.collapse-arrow');
                if (arrow) arrow.textContent = '▸';
            } else if (savedState[key] === false) {
                section.classList.remove('collapsed');
                const arrow = section.querySelector('.collapse-arrow');
                if (arrow) arrow.textContent = '▾';
            }

            const title = section.querySelector('.section-title');
            if (title) {
                title.addEventListener('click', () => {
                    section.classList.toggle('collapsed');
                    const arrow = section.querySelector('.collapse-arrow');
                    if (arrow) {
                        arrow.textContent = section.classList.contains('collapsed') ? '▸' : '▾';
                    }
                    this._saveCollapseState();
                });
            }
        });
    }

    _loadCollapseState() {
        try {
            const data = localStorage.getItem('ui-collapse-state');
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }

    _saveCollapseState() {
        try {
            const state = {};
            document.querySelectorAll('.section').forEach(section => {
                const key = section.dataset.section;
                if (key) {
                    state[key] = section.classList.contains('collapsed');
                }
            });
            localStorage.setItem('ui-collapse-state', JSON.stringify(state));
        } catch { /* ignore */ }
    }

    // --- 面板切換 ---
    setupPanelToggle() {
        const savedHidden = localStorage.getItem('ui-panel-hidden') === 'true';
        if (savedHidden) {
            this.uiPanel.classList.add('hidden');
            this.panelOpenBtn.classList.add('visible');
        }

        this.panelCloseBtn.addEventListener('click', () => {
            this.uiPanel.classList.add('hidden');
            this.panelOpenBtn.classList.add('visible');
            localStorage.setItem('ui-panel-hidden', 'true');
        });

        this.panelOpenBtn.addEventListener('click', () => {
            this.uiPanel.classList.remove('hidden');
            this.panelOpenBtn.classList.remove('visible');
            localStorage.setItem('ui-panel-hidden', 'false');
        });
    }

    // --- 事件處理函式 ---
    handleParticleSettingsChange() {
        const type = this.particleTypeSelect.value;
        const color = this.particleColorInput.value;
        this.stateManager.setParticleSettings(type, color);
    }

    handlePlaneOffsetChange() {
        const offset = {
            x: parseFloat(this.planeOffsetXSlider.value),
            z: parseFloat(this.planeOffsetZSlider.value),
        };
        this.stateManager.setPlaneOffset(offset);
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
        const state = this.stateManager.getState();
        if (state.particlePoints.length > 0 || state.drawingGroups.length > 0) {
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

        // 更新橡皮擦模式按鈕
        Object.entries(this.eraserModeButtons).forEach(([mode, button]) => {
            button.classList.toggle('active', mode === state.eraserMode);
        });

        // 顯示/隱藏橡皮擦模式控制
        this.eraserModeGroup.style.display = state.currentMode === 'eraser' ? 'block' : 'none';

        // 更新形狀填充模式按鈕
        Object.entries(this.shapeFillModeButtons).forEach(([mode, button]) => {
            button.classList.toggle('active', mode === state.shapeFillMode);
        });

        // 顯示/隱藏形狀填充模式控制
        this.shapeFillModeGroup.style.display =
            (state.currentMode === 'rectangle' || state.currentMode === 'circle') ? 'block' : 'none';

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

        // 更新平面偏移
        this.planeOffsetXSlider.value = state.planeOffset.x;
        this.offsetXDisplay.textContent = state.planeOffset.x;
        this.planeOffsetZSlider.value = state.planeOffset.z;
        this.offsetZDisplay.textContent = state.planeOffset.z;

        // 更新場景設定
        this.gridSizeSlider.value = state.gridSize;
        this.gridSizeDisplay.textContent = state.gridSize;
        this.cameraSensitivitySlider.value = state.cameraSensitivity;
        this.sensitivityDisplay.textContent = state.cameraSensitivity.toFixed(1);

        // 更新專案顯示
        this.projectNameInput.value = state.currentProjectName;
        this.skillIdInput.value = state.skillId;
        this.currentProjectDisplay.textContent = state.hasUnsavedChanges ? `${state.currentProjectName} *` : state.currentProjectName;

        // 清除程式碼輸出
        this.codeGenerator.clearOutput();

        // 更新浮動調色盤
        this.floatingPalette.update(state);
    }

    // 將專案管理按鈕的事件監聽器與 ProjectManager 連接
    bindProjectManager(projectManager) {
        this.newProjectBtn.addEventListener('click', () => projectManager.newProject());
        this.saveProjectBtn.addEventListener('click', () => projectManager.saveProject());
        this.loadProjectBtn.addEventListener('click', () => projectManager.loadProject());
    }
}

export default UIManager;
