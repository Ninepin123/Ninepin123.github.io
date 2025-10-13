/**
 * CursorManager - 管理不同工具的游標樣式
 */
class CursorManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.currentMode = 'camera';
    }

    /**
     * 根據模式更新游標
     */
    updateCursor(mode) {
        this.currentMode = mode;

        switch (mode) {
            case 'camera':
                this.canvas.style.cursor = 'grab';
                break;

            case 'select':
                this.canvas.style.cursor = 'pointer';
                break;

            case 'point':
                this.canvas.style.cursor = 'crosshair';
                break;

            case 'brush':
                // 使用圓形游標表示筆刷
                this.canvas.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><circle cx=\'12\' cy=\'12\' r=\'8\' fill=\'none\' stroke=\'%2300ff00\' stroke-width=\'2\'/><circle cx=\'12\' cy=\'12\' r=\'2\' fill=\'%2300ff00\'/></svg>") 12 12, crosshair';
                break;

            case 'eraser':
                // 使用方形游標表示橡皮擦
                this.canvas.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><rect x=\'6\' y=\'6\' width=\'12\' height=\'12\' fill=\'none\' stroke=\'%23ff0000\' stroke-width=\'2\'/><line x1=\'6\' y1=\'6\' x2=\'18\' y2=\'18\' stroke=\'%23ff0000\' stroke-width=\'2\'/></svg>") 12 12, crosshair';
                break;

            case 'rectangle':
                // 方塊工具使用十字準星
                this.canvas.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><rect x=\'6\' y=\'6\' width=\'12\' height=\'12\' fill=\'none\' stroke=\'%2300aaff\' stroke-width=\'2\'/></svg>") 12 12, crosshair';
                break;

            case 'circle':
                // 圓形工具使用圓形游標
                this.canvas.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><circle cx=\'12\' cy=\'12\' r=\'8\' fill=\'none\' stroke=\'%2300aaff\' stroke-width=\'2\'/></svg>") 12 12, crosshair';
                break;

            default:
                this.canvas.style.cursor = 'default';
        }
    }

    /**
     * 設定拖動中的游標
     */
    setDraggingCursor() {
        if (this.currentMode === 'camera') {
            this.canvas.style.cursor = 'grabbing';
        }
    }

    /**
     * 恢復原始游標
     */
    restoreCursor() {
        this.updateCursor(this.currentMode);
    }

    /**
     * 設定懸停在可選擇物件上的游標
     */
    setHoverCursor() {
        if (this.currentMode === 'select') {
            this.canvas.style.cursor = 'grab';
        }
    }

    /**
     * 設定調整大小的游標
     */
    setResizeCursor(direction) {
        const cursors = {
            'nw': 'nwse-resize',
            'ne': 'nesw-resize',
            'sw': 'nesw-resize',
            'se': 'nwse-resize',
            'n': 'ns-resize',
            's': 'ns-resize',
            'e': 'ew-resize',
            'w': 'ew-resize'
        };
        this.canvas.style.cursor = cursors[direction] || 'pointer';
    }
}

export default CursorManager;
