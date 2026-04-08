class FloatingPalette {
    constructor(stateManager, particleColorInput) {
        this.stateManager = stateManager;
        this.particleColorInput = particleColorInput;

        this.floatingPalette = document.querySelector('#floating-palette');
        this.paletteHeader = document.querySelector('#palette-header');
        this.paletteSwatches = document.querySelector('#palette-swatches');

        this.setupPaletteDragging();
        this.setupSwatchEvents();
    }

    setupSwatchEvents() {
        // 監聽整個調色盤區域的點擊（事件代理）
        this.paletteSwatches.addEventListener('click', (event) => {
            const swatch = event.target.closest('.color-swatch');
            if (!swatch) return;

            event.stopPropagation();
            event.preventDefault();

            const clickedColor = swatch.dataset.color;
            if (!clickedColor) return;

            const currentState = this.stateManager.getState();
            if (currentState.particleType === 'reddust') {
                this.stateManager.setParticleSettings('reddust', clickedColor);
                this.showFeedback(clickedColor);
            } else {
                this.showError('請先選擇紅石粒子類型');
            }
        });
    }

    update(state) {
        const isReddustMode = state.particleType === 'reddust';
        this.floatingPalette.classList.toggle('hidden', !isReddustMode);

        if (!isReddustMode) return;

        const uniqueColors = Array.isArray(state.usedColors) ? state.usedColors : [];

        // 清除舊的顏色樣本
        this.paletteSwatches.innerHTML = '';

        if (uniqueColors.length === 0) {
            this.paletteSwatches.textContent = '尚無顏色';
            return;
        }

        // 為每個獨一無二的顏色建立一個樣本
        uniqueColors.forEach((color) => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.title = `點擊切換到顏色: ${color}`;
            swatch.style.pointerEvents = 'auto';
            swatch.style.cursor = 'pointer';

            if (color === state.particleColor) {
                swatch.classList.add('active');
            }

            this.paletteSwatches.appendChild(swatch);
        });
    }

    setupPaletteDragging() {
        let isDragging = false;
        let dragStarted = false;
        let offsetX, offsetY;

        const onMouseDown = (e) => {
            if (e.target.closest('.color-swatch')) return;

            isDragging = true;
            dragStarted = false;
            offsetX = e.clientX - this.floatingPalette.offsetLeft;
            offsetY = e.clientY - this.floatingPalette.offsetTop;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;

            if (!dragStarted) {
                dragStarted = true;
                this.floatingPalette.style.transition = 'none';
            }

            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;

            const paletteRect = this.floatingPalette.getBoundingClientRect();
            const bodyRect = document.body.getBoundingClientRect();

            if (newX < 0) newX = 0;
            if (newY < 0) newY = 0;
            if (newX + paletteRect.width > bodyRect.width) newX = bodyRect.width - paletteRect.width;
            if (newY + paletteRect.height > bodyRect.height) newY = bodyRect.height - paletteRect.height;

            this.floatingPalette.style.left = `${newX}px`;
            this.floatingPalette.style.top = `${newY}px`;
            this.floatingPalette.style.bottom = 'auto';
            this.floatingPalette.style.transform = 'none';
        };

        const onMouseUp = () => {
            isDragging = false;
            dragStarted = false;
            this.floatingPalette.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        this.paletteHeader.addEventListener('mousedown', onMouseDown);
    }

    showFeedback(color) {
        this.particleColorInput.value = color;

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

        const style = document.createElement('style');
        style.textContent = `
            @keyframes floatingPaletteFeedback {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8) rotate(-5deg); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1.05) rotate(2deg); }
                40% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
                70% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9) rotate(1deg); }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(feedback);

        setTimeout(() => {
            if (document.body.contains(feedback)) document.body.removeChild(feedback);
            if (document.head.contains(style)) document.head.removeChild(style);
        }, 2000);
    }

    showError(message) {
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

        const style = document.createElement('style');
        style.textContent = `
            @keyframes floatingPaletteError {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8) shake(0deg); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1.05) shake(-3deg); }
                40% { opacity: 1; transform: translate(-50%, -50%) scale(1) shake(3deg); }
                60% { opacity: 1; transform: translate(-50%, -50%) scale(1) shake(-2deg); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1) shake(0deg); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(errorFeedback);

        setTimeout(() => {
            if (document.body.contains(errorFeedback)) document.body.removeChild(errorFeedback);
            if (document.head.contains(style)) document.head.removeChild(style);
        }, 2000);
    }

    rgbToHex(rgb) {
        if (rgb.startsWith('rgb')) {
            const matches = rgb.match(/\d+/g);
            if (matches && matches.length >= 3) {
                const r = parseInt(matches[0]).toString(16).padStart(2, '0');
                const g = parseInt(matches[1]).toString(16).padStart(2, '0');
                const b = parseInt(matches[2]).toString(16).padStart(2, '0');
                return `#${r}${g}${b}`;
            }
        }
        return rgb.startsWith('#') ? rgb : '#000000';
    }
}

export default FloatingPalette;
