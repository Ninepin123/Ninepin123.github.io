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

        // --- 浮動調色盤 ---
        this.floatingPalette = document.querySelector('#floating-palette');
        this.paletteHeader = document.querySelector('#palette-header'); // 新增標頭參照
        this.paletteSwatches = document.querySelector('#palette-swatches');
        
        console.log(`[浮動調色盤] 初始化完成:`, {
            floatingPalette: this.floatingPalette,
            paletteHeader: this.paletteHeader,
            paletteSwatches: this.paletteSwatches
        });

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

        // 場景設定
        this.gridSizeSlider.addEventListener('input', (e) => this.stateManager.setGridSize(parseInt(e.target.value)));
        this.cameraSensitivitySlider.addEventListener('input', (e) => this.stateManager.setCameraSensitivity(parseFloat(e.target.value)));

        // 添加雙擊編輯功能
        this.setupDoubleClickEditing();

        // 操作按鈕
        this.generateBtn.addEventListener('click', () => this.generateCode());
        this.copyCodeBtn.addEventListener('click', () => this.copyCode());
        this.clearBtn.addEventListener('click', () => this.requestClear());
        this.undoBtn.addEventListener('click', () => this.stateManager.undoLastPoint());

        // 專案管理
        this.projectNameInput.addEventListener('input', (e) => this.stateManager.setProjectName(e.target.value));
        this.skillIdInput.addEventListener('input', (e) => this.stateManager.setSkillId(e.target.value));
        

        // 設定浮動調色盤可拖動
        this.setupPaletteDragging();

        // 定義顏色切換處理函數
        const handleColorSwitch = (event) => {
            console.log(`[浮動調色盤] ========== 顏色切換事件開始 ==========`);
            console.log(`[浮動調色盤] 事件類型:`, event.type);
            console.log(`[浮動調色盤] 點擊目標:`, event.target);
            console.log(`[浮動調色盤] 點擊目標類名:`, event.target.className);
            console.log(`[浮動調色盤] 點擊目標標籤:`, event.target.tagName);
            
            // 阻止事件冒泡，確保只處理一次
            event.stopPropagation();
            event.preventDefault();
            
            const swatch = event.target.closest('.color-swatch');
            console.log(`[浮動調色盤] 找到的色塊元素:`, swatch);
            
            if (swatch) {
                const clickedColor = swatch.dataset.color;
                const backgroundColor = swatch.style.backgroundColor;
                
                console.log(`[浮動調色盤] 色塊資料 - dataset.color:`, clickedColor);
                console.log(`[浮動調色盤] 色塊資料 - backgroundColor:`, backgroundColor);
                console.log(`[浮動調色盤] 色塊類名:`, swatch.className);
                
                if (clickedColor) {
                    const currentState = this.stateManager.getState();
                    console.log(`[浮動調色盤] 當前狀態 - particleType:`, currentState.particleType);
                    console.log(`[浮動調色盤] 當前狀態 - particleColor:`, currentState.particleColor);
                    
                    // 確保是紅石粒子才切換顏色
                    if (currentState.particleType === 'reddust') {
                        console.log(`[浮動調色盤] ✅ 開始切換顏色到:`, clickedColor);
                        
                        // 執行顏色切換
                        this.stateManager.setParticleSettings('reddust', clickedColor);
                        console.log(`[浮動調色盤] ✅ 顏色切換完成`);
                        
                        // 顯示視覺反饋
                        this.showFloatingPaletteFeedback(clickedColor);
                        console.log(`[浮動調色盤] ✅ 視覺反饋已觸發`);
                    } else {
                        console.warn(`[浮動調色盤] ❌ 無法切換顏色 - 當前不是紅石粒子模式:`, currentState.particleType);
                        
                        // 顯示錯誤提示
                        this.showFloatingPaletteError('請先選擇紅石粒子類型');
                    }
                } else {
                    console.warn(`[浮動調色盤] ❌ 色塊沒有 dataset.color 屬性`);
                    console.warn(`[浮動調色盤] 色塊完整資訊:`, {
                        element: swatch,
                        dataset: swatch.dataset,
                        style: swatch.style.cssText
                    });
                }
            } else {
                console.log(`[浮動調色盤] ℹ️ 點擊的不是色塊元素`);
                console.log(`[浮動調色盤] 所有子元素:`, Array.from(this.paletteSwatches.children));
            }
            
            console.log(`[浮動調色盤] ========== 顏色切換事件結束 ==========`);
        };

        // 使用多種事件監聽方式確保能捕捉到點擊
        this.paletteSwatches.addEventListener('click', handleColorSwitch);
        this.paletteSwatches.addEventListener('mouseup', (event) => {
            // 只有在沒有拖拽的情況下才處理 mouseup 作為點擊
            if (event.target.closest('.color-swatch')) {
                console.log(`[浮動調色盤] mouseup 被當作點擊處理`);
                handleColorSwitch(event);
            }
        });
        
        // 額外的事件監聽器用於除錯
        this.paletteSwatches.addEventListener('mousedown', (event) => {
            console.log(`[浮動調色盤] mousedown 事件:`, event.target);
        });
        
        this.paletteSwatches.addEventListener('mouseup', (event) => {
            console.log(`[浮動調色盤] mouseup 事件:`, event.target);
        });
        
        // 監聽整個浮動調色盤的點擊事件
        this.floatingPalette.addEventListener('click', (event) => {
            console.log(`[浮動調色盤] 調色盤區域點擊:`, event.target);
            console.log(`[浮動調色盤] 點擊位置:`, { x: event.clientX, y: event.clientY });
        });
        
    }

    setupPaletteDragging() {
        let isDragging = false;
        let dragStarted = false;
        let offsetX, offsetY;

        const onMouseDown = (e) => {
            console.log(`[拖拽] mousedown 在標頭上`);
            
            // 檢查是否點擊在色塊上，如果是則不啟動拖拽
            if (e.target.closest('.color-swatch')) {
                console.log(`[拖拽] 點擊在色塊上，不啟動拖拽`);
                return;
            }
            
            isDragging = true;
            dragStarted = false;
            // 計算滑鼠點擊位置相對於調色盤左上角的偏移
            offsetX = e.clientX - this.floatingPalette.offsetLeft;
            offsetY = e.clientY - this.floatingPalette.offsetTop;

            console.log(`[拖拽] 拖拽準備就緒`);

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            
            // 標記已開始拖拽
            if (!dragStarted) {
                dragStarted = true;
                console.log(`[拖拽] 開始拖拽`);
                // 移除可能影響拖曳的 transition 效果
                this.floatingPalette.style.transition = 'none';
            }

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
            console.log(`[拖拽] mouseup，isDragging: ${isDragging}, dragStarted: ${dragStarted}`);
            
            isDragging = false;
            dragStarted = false;
            
            // 恢復 transition 效果
            this.floatingPalette.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            console.log(`[拖拽] 拖拽結束`);
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
        console.log(`[UIManager] updateUI - 更新粒子設定: type=${state.particleType}, color=${state.particleColor}`);
        
        this.particleTypeSelect.value = state.particleType;
        this.particleColorInput.value = state.particleColor;
        
        console.log(`[UIManager] updateUI - 顏色選擇器已更新為: ${this.particleColorInput.value}`);
        
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
        if (this.codeOutput.value) this.codeOutput.value = '';

        this.updateFloatingPalette(state);
    }

    updateFloatingPalette(state) {
        console.log(`[浮動調色盤] updateFloatingPalette 被調用`);
        console.log(`[浮動調色盤] 當前粒子類型:`, state.particleType);
        console.log(`[浮動調色盤] 粒子點數量:`, state.particlePoints.length);
        
        const isReddustMode = state.particleType === 'reddust';
        console.log(`[浮動調色盤] 是否為紅石模式:`, isReddustMode);
        
        this.floatingPalette.classList.toggle('hidden', !isReddustMode);
        console.log(`[浮動調色盤] 調色盤可見性:`, !this.floatingPalette.classList.contains('hidden'));

        if (isReddustMode) {
            // 從粒子點中提取所有獨一無二的顏色
            const allColors = state.particlePoints.map(p => p.color).filter(c => c);
            const uniqueColors = [...new Set(allColors)];
            
            console.log(`[浮動調色盤] 所有粒子顏色:`, allColors);
            console.log(`[浮動調色盤] 獨一無二的顏色:`, uniqueColors);

            // 清除舊的顏色樣本
            this.paletteSwatches.innerHTML = '';
            console.log(`[浮動調色盤] 已清空舊的色塊`);

            if (uniqueColors.length === 0) {
                // 如果沒有顏色，可以顯示一則訊息
                this.paletteSwatches.textContent = '尚無顏色';
                console.log(`[浮動調色盤] 顯示"尚無顏色"訊息`);
                return;
            }

            // 為每個獨一無二的顏色建立一個樣本
            uniqueColors.forEach((color, index) => {
                console.log(`[浮動調色盤] 創建色塊 ${index + 1}/${uniqueColors.length}: ${color}`);
                
                const swatch = document.createElement('div');
                swatch.className = 'color-swatch';
                swatch.style.backgroundColor = color;
                swatch.dataset.color = color; // 將顏色儲存在 data 屬性中
                swatch.title = `點擊切換到顏色: ${color}`;
                
                // 標記當前選中的顏色
                if (color === state.particleColor) {
                    swatch.classList.add('active');
                    console.log(`[浮動調色盤] 色塊 ${color} 被標記為 active`);
                }
                
                // 確保色塊可以接收點擊事件
                swatch.style.pointerEvents = 'auto';
                swatch.style.cursor = 'pointer';
                
                // 直接為每個色塊添加點擊事件監聽器
                swatch.addEventListener('click', (e) => {
                    console.log(`[浮動調色盤] 直接點擊事件 - 色塊: ${color}`);
                    e.stopPropagation();
                    e.preventDefault();
                    
                    const currentState = this.stateManager.getState();
                    if (currentState.particleType === 'reddust') {
                        console.log(`[浮動調色盤] 直接切換到顏色: ${color}`);
                        this.stateManager.setParticleSettings('reddust', color);
                        this.showFloatingPaletteFeedback(color);
                    } else {
                        console.warn(`[浮動調色盤] 不是紅石模式，無法切換`);
                        this.showFloatingPaletteError('請先選擇紅石粒子類型');
                    }
                });
                
                // 也添加 mouseup 事件作為備用
                swatch.addEventListener('mouseup', (e) => {
                    console.log(`[浮動調色盤] 直接 mouseup 事件 - 色塊: ${color}`);
                    e.stopPropagation();
                    e.preventDefault();
                    
                    const currentState = this.stateManager.getState();
                    if (currentState.particleType === 'reddust') {
                        console.log(`[浮動調色盤] 通過 mouseup 切換到顏色: ${color}`);
                        this.stateManager.setParticleSettings('reddust', color);
                        this.showFloatingPaletteFeedback(color);
                    } else {
                        console.warn(`[浮動調色盤] 不是紅石模式，無法切換`);
                        this.showFloatingPaletteError('請先選擇紅石粒子類型');
                    }
                });
                
                this.paletteSwatches.appendChild(swatch);
                console.log(`[浮動調色盤] 色塊 ${color} 已添加到 DOM 並綁定事件`);
                
                // 驗證元素是否正確創建
                setTimeout(() => {
                    const rect = swatch.getBoundingClientRect();
                    console.log(`[浮動調色盤] 色塊 ${color} 位置信息:`, {
                        width: rect.width,
                        height: rect.height,
                        visible: rect.width > 0 && rect.height > 0,
                        datasetColor: swatch.dataset.color,
                        backgroundColor: swatch.style.backgroundColor
                    });
                }, 50);
            });
            
            console.log(`[浮動調色盤] 所有色塊創建完成，總數:`, this.paletteSwatches.children.length);
        } else {
            console.log(`[浮動調色盤] 非紅石模式，隱藏調色盤`);
        }
    }

    // --- 浮動調色盤視覺反饋 ---
    showFloatingPaletteFeedback(color) {
        console.log(`[浮動調色盤] 顯示切換反饋:`, color);
        
        // 更新顏色選擇器的值
        this.particleColorInput.value = color;
        console.log(`[浮動調色盤] 顏色選擇器已更新為:`, color);
        
        // 創建臨時提示元素
        const feedback = document.createElement('div');
        feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 153, 255, 0.95);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            border: 2px solid rgba(255, 255, 255, 0.2);
            animation: floatingPaletteFeedback 2s ease-out forwards;
        `;
        feedback.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; background: ${color}; border-radius: 50%; border: 2px solid white;"></div>
                <span>已切換到顏色 ${color}</span>
            </div>
        `;
        
        // 添加CSS動畫
        const style = document.createElement('style');
        style.textContent = `
            @keyframes floatingPaletteFeedback {
                0% { 
                    opacity: 0; 
                    transform: translate(-50%, -50%) scale(0.8) rotate(-5deg); 
                }
                20% { 
                    opacity: 1; 
                    transform: translate(-50%, -50%) scale(1.05) rotate(2deg); 
                }
                40% { 
                    opacity: 1; 
                    transform: translate(-50%, -50%) scale(1) rotate(0deg); 
                }
                70% { 
                    opacity: 1; 
                    transform: translate(-50%, -50%) scale(1) rotate(0deg); 
                }
                100% { 
                    opacity: 0; 
                    transform: translate(-50%, -50%) scale(0.9) rotate(1deg); 
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(feedback);
        
        console.log(`[浮動調色盤] 反饋動畫已顯示`);
        
        // 2秒後移除提示
        setTimeout(() => {
            if (document.body.contains(feedback)) {
                document.body.removeChild(feedback);
            }
            if (document.head.contains(style)) {
                document.head.removeChild(style);
            }
            console.log(`[浮動調色盤] 反饋動畫已移除`);
        }, 2000);
    }

    // --- 浮動調色盤錯誤提示 ---
    showFloatingPaletteError(message) {
        console.log(`[浮動調色盤] 顯示錯誤提示:`, message);
        
        // 創建錯誤提示元素
        const errorFeedback = document.createElement('div');
        errorFeedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(220, 53, 69, 0.95);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            border: 2px solid rgba(255, 255, 255, 0.2);
            animation: floatingPaletteError 2s ease-out forwards;
        `;
        errorFeedback.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="font-size: 18px;">⚠️</div>
                <span>${message}</span>
            </div>
        `;
        
        // 添加CSS動畫
        const style = document.createElement('style');
        style.textContent = `
            @keyframes floatingPaletteError {
                0% { 
                    opacity: 0; 
                    transform: translate(-50%, -50%) scale(0.8) shake(0deg); 
                }
                20% { 
                    opacity: 1; 
                    transform: translate(-50%, -50%) scale(1.05) shake(-3deg); 
                }
                40% { 
                    opacity: 1; 
                    transform: translate(-50%, -50%) scale(1) shake(3deg); 
                }
                60% { 
                    opacity: 1; 
                    transform: translate(-50%, -50%) scale(1) shake(-2deg); 
                }
                80% { 
                    opacity: 1; 
                    transform: translate(-50%, -50%) scale(1) shake(0deg); 
                }
                100% { 
                    opacity: 0; 
                    transform: translate(-50%, -50%) scale(0.9); 
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(errorFeedback);
        
        console.log(`[浮動調色盤] 錯誤提示已顯示`);
        
        // 2秒後移除提示
        setTimeout(() => {
            if (document.body.contains(errorFeedback)) {
                document.body.removeChild(errorFeedback);
            }
            if (document.head.contains(style)) {
                document.head.removeChild(style);
            }
            console.log(`[浮動調色盤] 錯誤提示已移除`);
        }, 2000);
    }

    // --- 程式碼生成與複製 ---
    copyCode() {
        const code = this.codeOutput.value;
        if (!code || code.trim() === "" || code === "畫布上沒有任何粒子點，請先點擊繪製！") {
            // 如果沒有程式碼，先生成程式碼
            this.generateCode();
            // 重新獲取程式碼
            const newCode = this.codeOutput.value;
            if (!newCode || newCode.trim() === "" || newCode === "畫布上沒有任何粒子點，請先點擊繪製！") {
                this.showCopyFeedback('沒有可複製的內容！', false);
                return;
            }
        }

        // 使用 navigator.clipboard 或降級到舊方法
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(this.codeOutput.value).then(() => {
                this.showCopyFeedback('已複製！', true);
            }).catch(err => {
                console.error('無法複製程式碼: ', err);
                this.fallbackCopyTextToClipboard(this.codeOutput.value);
            });
        } else {
            // 降級方法
            this.fallbackCopyTextToClipboard(this.codeOutput.value);
        }
    }
    
    // 降級複製方法
    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // 避免在iOS中出現縮放效果
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            this.showCopyFeedback(successful ? '已複製！' : '複製失敗！', successful);
        } catch (err) {
            console.error('降級複製方法也失敗了: ', err);
            this.showCopyFeedback('複製失敗，請手動複製', false);
        }

        document.body.removeChild(textArea);
    }
    
    // 顯示複製反饋
    showCopyFeedback(message, success) {
        const originalText = this.copyCodeBtn.textContent;
        this.copyCodeBtn.textContent = message;
        this.copyCodeBtn.style.backgroundColor = success ? '#28a745' : '#dc3545';
        
        setTimeout(() => {
            this.copyCodeBtn.textContent = originalText;
            this.copyCodeBtn.style.backgroundColor = '';
        }, 1500);
    }

    generateCode() {
        const state = this.stateManager.getState();
        if (state.particlePoints.length === 0 && state.drawingGroups.length === 0) {
            this.codeOutput.value = "畫布上沒有任何粒子點，請先點擊繪製！";
            return;
        }

        const skillId = state.skillId || 'MyDrawingSkill';
        const skillLines = [`${skillId}:`, '  Skills:'];

        // 從個別粒子點生成程式碼
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

        // 從繪圖群組生成程式碼
        state.drawingGroups.forEach(group => {
            if (group.particles && group.particles.length > 0) {
                group.particles.forEach(point => {
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
            }
        });

        this.codeOutput.value = skillLines.join('\n');
    }



    // --- RGB 轉 HEX 工具方法 ---
    rgbToHex(rgb) {
        // 處理 rgb(r, g, b) 格式
        if (rgb.startsWith('rgb')) {
            const matches = rgb.match(/\d+/g);
            if (matches && matches.length >= 3) {
                const r = parseInt(matches[0]).toString(16).padStart(2, '0');
                const g = parseInt(matches[1]).toString(16).padStart(2, '0');
                const b = parseInt(matches[2]).toString(16).padStart(2, '0');
                return `#${r}${g}${b}`;
            }
        }
        // 如果已經是 hex 格式，直接返回
        return rgb.startsWith('#') ? rgb : '#000000';
    }


    // 設置雙擊編輯功能
    setupDoubleClickEditing() {
        // 繪畫高度
        this.setupDisplayDoubleClick(
            this.heightDisplay, 
            'height', 
            (value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue >= 0 && numValue <= 10) {
                    this.drawingHeightSlider.value = numValue;
                    this.stateManager.setDrawingHeight(numValue);
                    return true;
                }
                return false;
            },
            (value) => value.toFixed(1)
        );

        // 攝影機靈敏度
        this.setupDisplayDoubleClick(
            this.sensitivityDisplay, 
            'sensitivity', 
            (value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue >= 0.1 && numValue <= 3) {
                    this.cameraSensitivitySlider.value = numValue;
                    this.stateManager.setCameraSensitivity(numValue);
                    return true;
                }
                return false;
            },
            (value) => value.toFixed(1)
        );

        // 平面旋轉 X軸
        this.setupDisplayDoubleClick(
            this.rotationXDisplay, 
            'rotation-x', 
            (value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue >= -180 && numValue <= 180) {
                    this.planeRotationXSlider.value = numValue;
                    this.handlePlaneRotationChange();
                    return true;
                }
                return false;
            },
            (value) => `${Math.round(value)}°`
        );

        // 平面旋轉 Y軸
        this.setupDisplayDoubleClick(
            this.rotationYDisplay, 
            'rotation-y', 
            (value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue >= -180 && numValue <= 180) {
                    this.planeRotationYSlider.value = numValue;
                    this.handlePlaneRotationChange();
                    return true;
                }
                return false;
            },
            (value) => `${Math.round(value)}°`
        );

        // 平面旋轉 Z軸
        this.setupDisplayDoubleClick(
            this.rotationZDisplay, 
            'rotation-z', 
            (value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue >= -180 && numValue <= 180) {
                    this.planeRotationZSlider.value = numValue;
                    this.handlePlaneRotationChange();
                    return true;
                }
                return false;
            },
            (value) => `${Math.round(value)}°`
        );
    }

    // 通用的雙擊編輯設置方法
    setupDisplayDoubleClick(displayElement, identifier, validateAndUpdate, formatValue) {
        let isEditing = false;
        
        displayElement.style.cursor = 'pointer';
        displayElement.title = '點擊編輯數值';
        
        displayElement.addEventListener('click', () => {
            if (isEditing) return;
            
            isEditing = true;
            const originalValue = displayElement.textContent;
            const numericValue = originalValue.replace(/[^\d.-]/g, ''); // 移除非數字字符
            
            // 創建輸入框
            const input = document.createElement('input');
            input.type = 'number';
            input.value = numericValue;
            input.className = `editing-input editing-${identifier}`;
            input.style.cssText = `
                width: ${displayElement.offsetWidth + 20}px;
                height: ${displayElement.offsetHeight}px;
                font-size: ${window.getComputedStyle(displayElement).fontSize};
                font-family: ${window.getComputedStyle(displayElement).fontFamily};
                text-align: center;
                border: 2px solid #007bff;
                border-radius: 4px;
                background: #fff;
                color: #333;
                outline: none;
                box-shadow: 0 0 8px rgba(0, 123, 255, 0.3);
            `;
            
            // 替換顯示元素
            displayElement.style.display = 'none';
            displayElement.parentNode.appendChild(input);
            
            // 選中文字並聚焦
            input.focus();
            input.select();
            
            const finishEditing = (save = false) => {
                if (!isEditing) return;
                
                let success = false;
                if (save) {
                    const newValue = input.value.trim();
                    if (newValue !== '' && validateAndUpdate(newValue)) {
                        success = true;
                    } else {
                        // 顯示錯誤提示
                        input.style.borderColor = '#dc3545';
                        input.style.boxShadow = '0 0 8px rgba(220, 53, 69, 0.3)';
                        setTimeout(() => {
                            if (input.parentNode) {
                                input.style.borderColor = '#007bff';
                                input.style.boxShadow = '0 0 8px rgba(0, 123, 255, 0.3)';
                            }
                        }, 1000);
                        return; // 不結束編輯
                    }
                }
                
                // 清理編輯狀態
                isEditing = false;
                displayElement.style.display = '';
                if (input.parentNode) {
                    input.parentNode.removeChild(input);
                }
                
                if (success) {
                    // 顯示成功動畫
                    displayElement.style.animation = 'valueUpdated 0.6s ease-out';
                    setTimeout(() => {
                        displayElement.style.animation = '';
                    }, 600);
                }
            };
            
            // 事件監聽
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    finishEditing(true);
                } else if (e.key === 'Escape') {
                    finishEditing(false);
                }
            });
            
            input.addEventListener('blur', () => {
                finishEditing(true);
            });
        });
    }

    // 將專案管理按鈕的事件監聽器與 ProjectManager 連接
    bindProjectManager(projectManager) {
        this.newProjectBtn.addEventListener('click', () => projectManager.newProject());
        this.saveProjectBtn.addEventListener('click', () => projectManager.saveProject());
        this.loadProjectBtn.addEventListener('click', () => projectManager.loadProject());
    }
}

export default UIManager;