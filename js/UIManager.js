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
        this.animationEnabledCheckbox = document.querySelector('#animation-enabled');
        this.animationTickGroup = document.querySelector('#animation-tick-group');
        this.animationTickIntervalSlider = document.querySelector('#animation-tick-interval');
        this.animationTickDisplay = document.querySelector('#animation-tick-display');
        this.animationPreviewBtn = document.querySelector('#btn-animation-preview');
        this.toggleGroupAnimationBtn = document.querySelector('#btn-toggle-group-animation');
        this.selectedGroupStatus = document.querySelector('#selected-group-status');
        this.groupTickOverrideGroup = document.querySelector('#group-tick-override-group');
        this.groupTickInput = document.querySelector('#group-tick-interval');
        this.groupTickStatus = document.querySelector('#group-tick-status');
        this.resetGroupTickBtn = document.querySelector('#btn-reset-group-tick');
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
            mirror: document.querySelector('#btn-mode-mirror'),
        };

        // --- 鏡子管理 ---
        this.mirrorCountDisplay = document.querySelector('#mirror-count');
        this.clearMirrorsBtn = document.querySelector('#btn-clear-mirrors');

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

        // 動畫設定
        this.animationEnabledCheckbox.addEventListener('change', (e) => {
            if (!e.target.checked && this.animationPreview && this.animationPreview.isRunning()) {
                this.animationPreview.stop();
            }
            this.stateManager.setAnimationEnabled(e.target.checked);
        });
        this.animationTickIntervalSlider.addEventListener('input', (e) => {
            this.stateManager.setAnimationTickInterval(parseFloat(e.target.value));
        });
        this.toggleGroupAnimationBtn.addEventListener('click', () => {
            const sel = this.stateManager.getState().selectedGroup;
            if (sel && sel.id) {
                this.stateManager.toggleGroupAnimated(sel.id);
            }
        });
        this.groupTickInput.addEventListener('input', (e) => {
            const sel = this.stateManager.getState().selectedGroup;
            if (sel && sel.id) {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v > 0) {
                    this.stateManager.setGroupTickInterval(sel.id, v);
                }
            }
        });
        this.resetGroupTickBtn.addEventListener('click', () => {
            const sel = this.stateManager.getState().selectedGroup;
            if (sel && sel.id) {
                this.stateManager.setGroupTickInterval(sel.id, null);
            }
        });

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

        // 鏡子管理
        this.clearMirrorsBtn.addEventListener('click', () => {
            const state = this.stateManager.getState();
            if (state.mirrors.length === 0) return;
            if (confirm(`確定要清除 ${state.mirrors.length} 面鏡子嗎？已繪製的粒子不會被刪除。`)) {
                this.stateManager.clearMirrors();
            }
        });
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

        // 更新動畫設定
        this.animationEnabledCheckbox.checked = !!state.animationEnabled;
        this.animationTickGroup.style.display = state.animationEnabled ? 'block' : 'none';
        this.animationTickIntervalSlider.value = state.animationTickInterval;
        this.animationTickDisplay.textContent = Number(state.animationTickInterval).toFixed(1);

        // 選中群組的動畫狀態
        const selectedId = state.selectedGroup && state.selectedGroup.id;
        const selectedGroup = selectedId
            ? state.drawingGroups.find(g => g.id === selectedId)
            : null;
        if (selectedGroup) {
            this.toggleGroupAnimationBtn.disabled = false;
            this.selectedGroupStatus.textContent = selectedGroup.isAnimated
                ? `已選中：動畫群組（${selectedGroup.particles.length} 粒子）`
                : `已選中：靜態群組（${selectedGroup.particles.length} 粒子）`;
        } else {
            this.toggleGroupAnimationBtn.disabled = true;
            this.selectedGroupStatus.textContent = '未選中群組（用「選擇」工具點選）';
        }

        // 群組 tick 覆寫面板
        if (this.groupTickOverrideGroup) {
            const showOverride = !!(selectedGroup && selectedGroup.isAnimated);
            this.groupTickOverrideGroup.style.display = showOverride ? 'block' : 'none';
            if (showOverride) {
                const override = selectedGroup.tickInterval;
                if (override !== undefined && override !== null) {
                    if (document.activeElement !== this.groupTickInput) {
                        this.groupTickInput.value = override;
                    }
                    this.groupTickStatus.textContent = `已覆寫：每 ${Number(override).toFixed(2)} tick`;
                } else {
                    if (document.activeElement !== this.groupTickInput) {
                        this.groupTickInput.value = state.animationTickInterval;
                    }
                    this.groupTickStatus.textContent = `目前使用全域值（${Number(state.animationTickInterval).toFixed(1)} tick）`;
                }
            }
        }

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

        // 更新鏡子數量顯示
        if (this.mirrorCountDisplay) {
            this.mirrorCountDisplay.textContent = (state.mirrors || []).length;
        }
    }

    // 將專案管理按鈕的事件監聽器與 ProjectManager 連接
    bindProjectManager(projectManager) {
        this.newProjectBtn.addEventListener('click', () => projectManager.newProject());
        this.saveProjectBtn.addEventListener('click', () => projectManager.saveProject());
        this.loadProjectBtn.addEventListener('click', () => projectManager.loadProject());
    }

    // 綁定動畫預覽控制器
    bindAnimationPreview(animationPreview) {
        this.animationPreview = animationPreview;

        const updateBtn = () => {
            if (animationPreview.isRunning()) {
                this.animationPreviewBtn.textContent = '■ 停止預覽';
                this.animationPreviewBtn.classList.add('active');
            } else {
                this.animationPreviewBtn.textContent = '▶ 預覽動畫';
                this.animationPreviewBtn.classList.remove('active');
            }
        };

        animationPreview.onStart = updateBtn;
        animationPreview.onEnd = updateBtn;

        this.animationPreviewBtn.addEventListener('click', () => {
            if (animationPreview.isRunning()) {
                animationPreview.stop();
            } else {
                const started = animationPreview.play();
                if (!started) {
                    alert('畫布上沒有任何粒子點可預覽！');
                }
            }
        });
    }
}

export default UIManager;
