class InlineEditor {
    constructor(stateManager, uiManager) {
        this.stateManager = stateManager;
        this.uiManager = uiManager;
    }

    setup() {
        const ui = this.uiManager;

        // 網格大小
        this.setupDisplayDoubleClick(
            ui.gridSizeDisplay,
            'grid-size',
            (value) => {
                const numValue = parseInt(value, 10);
                if (!isNaN(numValue) && numValue >= 5 && numValue <= 50) {
                    ui.gridSizeSlider.value = numValue;
                    this.stateManager.setGridSize(numValue);
                    return true;
                }
                return false;
            },
            (value) => value.toString()
        );

        // 繪畫高度
        this.setupDisplayDoubleClick(
            ui.heightDisplay,
            'height',
            (value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue >= 0 && numValue <= 10) {
                    ui.drawingHeightSlider.value = numValue;
                    this.stateManager.setDrawingHeight(numValue);
                    return true;
                }
                return false;
            },
            (value) => value.toFixed(1)
        );

        // 攝影機靈敏度
        this.setupDisplayDoubleClick(
            ui.sensitivityDisplay,
            'sensitivity',
            (value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue > 0 && numValue <= 5) {
                    ui.cameraSensitivitySlider.value = numValue;
                    this.stateManager.setCameraSensitivity(numValue);
                    return true;
                }
                return false;
            },
            (value) => value.toFixed(1)
        );

        // 平面偏移 X
        this.setupDisplayDoubleClick(
            ui.offsetXDisplay,
            'offset X',
            (value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue >= -50 && numValue <= 50) {
                    ui.planeOffsetXSlider.value = numValue;
                    ui.handlePlaneOffsetChange();
                    return true;
                }
                return false;
            },
            (value) => value
        );

        // 平面偏移 Z
        this.setupDisplayDoubleClick(
            ui.offsetZDisplay,
            'offset Z',
            (value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue >= -50 && numValue <= 50) {
                    ui.planeOffsetZSlider.value = numValue;
                    ui.handlePlaneOffsetChange();
                    return true;
                }
                return false;
            },
            (value) => value
        );

        // 平面旋轉 X軸
        this.setupDisplayDoubleClick(
            ui.rotationXDisplay,
            'rotation-x',
            (value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue >= -180 && numValue <= 180) {
                    ui.planeRotationXSlider.value = numValue;
                    ui.handlePlaneRotationChange();
                    return true;
                }
                return false;
            },
            (value) => `${Math.round(value)}°`
        );

        // 平面旋轉 Y軸
        this.setupDisplayDoubleClick(
            ui.rotationYDisplay,
            'rotation-y',
            (value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue >= -180 && numValue <= 180) {
                    ui.planeRotationYSlider.value = numValue;
                    ui.handlePlaneRotationChange();
                    return true;
                }
                return false;
            },
            (value) => `${Math.round(value)}°`
        );

        // 平面旋轉 Z軸
        this.setupDisplayDoubleClick(
            ui.rotationZDisplay,
            'rotation-z',
            (value) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue >= -180 && numValue <= 180) {
                    ui.planeRotationZSlider.value = numValue;
                    ui.handlePlaneRotationChange();
                    return true;
                }
                return false;
            },
            (value) => `${Math.round(value)}°`
        );
    }

    setupDisplayDoubleClick(displayElement, identifier, validateAndUpdate, formatValue) {
        let isEditing = false;

        displayElement.style.cursor = 'pointer';
        displayElement.title = '點擊編輯數值';

        displayElement.addEventListener('click', () => {
            if (isEditing) return;

            isEditing = true;
            const originalValue = displayElement.textContent;
            const numericValue = originalValue.replace(/[^\d.-]/g, '');

            const rect = displayElement.getBoundingClientRect();

            const input = document.createElement('input');
            input.type = 'number';
            input.value = numericValue;
            input.className = `editing-input editing-${identifier}`;

            const inputWidth = rect.width + 20;
            const inputHeight = rect.height;
            const inputLeft = rect.left + window.scrollX - (inputWidth - rect.width) / 2;
            const inputTop = rect.top + window.scrollY;

            input.style.cssText = `
                position: absolute;
                left: ${inputLeft}px;
                top: ${inputTop}px;
                width: ${inputWidth}px;
                height: ${inputHeight}px;
                font-size: ${window.getComputedStyle(displayElement).fontSize};
                font-family: ${window.getComputedStyle(displayElement).fontFamily};
                text-align: center;
                border: 2px solid #007bff;
                border-radius: 4px;
                background: #fff;
                color: #333;
                outline: none;
                box-shadow: 0 0 8px rgba(0, 123, 255, 0.3);
                z-index: 9999;
            `;

            displayElement.style.visibility = 'hidden';
            document.body.appendChild(input);

            const updatePosition = () => {
                if (!isEditing || !document.body.contains(input)) return;
                const newRect = displayElement.getBoundingClientRect();
                const newInputLeft = newRect.left + window.scrollX - (inputWidth - newRect.width) / 2;
                const newInputTop = newRect.top + window.scrollY;
                input.style.left = `${newInputLeft}px`;
                input.style.top = `${newInputTop}px`;
            };

            window.addEventListener('scroll', updatePosition, true);
            const uiPanel = document.getElementById('ui-panel');
            if (uiPanel) {
                uiPanel.addEventListener('scroll', updatePosition);
            }

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
                        input.style.borderColor = '#dc3545';
                        input.style.boxShadow = '0 0 8px rgba(220, 53, 69, 0.3)';
                        setTimeout(() => {
                            if (document.body.contains(input)) {
                                input.style.borderColor = '#007bff';
                                input.style.boxShadow = '0 0 8px rgba(0, 123, 255, 0.3)';
                            }
                        }, 1000);
                        return;
                    }
                }

                isEditing = false;
                window.removeEventListener('scroll', updatePosition, true);
                if (uiPanel) {
                    uiPanel.removeEventListener('scroll', updatePosition);
                }

                displayElement.style.visibility = 'visible';
                displayElement.style.display = '';
                if (document.body.contains(input)) {
                    document.body.removeChild(input);
                }

                if (success) {
                    displayElement.style.animation = 'valueUpdated 0.6s ease-out';
                    setTimeout(() => {
                        displayElement.style.animation = '';
                    }, 600);
                }
            };

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
}

export default InlineEditor;
