class LocalStorageManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.STORAGE_KEY = 'mythicParticle3D_autoSave';
        this.SETTINGS_KEY = 'mythicParticle3D_settings';
        this.autoSaveInterval = null;
        this.AUTO_SAVE_DELAY = 2000; // 2秒自動儲存
    }

    // 初始化自動儲存
    init() {
        // 載入上次的工作
        this.loadAutoSave();

        // 設定自動儲存監聽
        this.stateManager.subscribe(() => {
            this.scheduleAutoSave();
        });

        // 監聽頁面關閉事件
        window.addEventListener('beforeunload', (e) => {
            const state = this.stateManager.getState();
            if (state.hasUnsavedChanges) {
                this.saveAutoSave();
                e.preventDefault();
                e.returnValue = '您有未儲存的變更，確定要離開嗎？';
                return e.returnValue;
            }
        });

        console.log('[LocalStorage] 自動儲存系統已初始化');
    }

    // 排程自動儲存（防抖）
    scheduleAutoSave() {
        if (this.autoSaveInterval) {
            clearTimeout(this.autoSaveInterval);
        }

        this.autoSaveInterval = setTimeout(() => {
            this.saveAutoSave();
        }, this.AUTO_SAVE_DELAY);
    }

    // 儲存到 localStorage
    saveAutoSave() {
        try {
            const state = this.stateManager.getState();

            const autoSaveData = {
                timestamp: new Date().toISOString(),
                projectName: state.currentProjectName,
                skillId: state.skillId,
                particles: state.particlePoints.map(p => ({
                    id: p.id,
                    x: p.x,
                    y: p.y,
                    z: p.z,
                    particleType: p.particleType,
                    color: p.color
                })),
                groups: state.drawingGroups.map(g => ({
                    id: g.id,
                    type: g.type,
                    particles: g.particles || [],
                    bounds: g.bounds,
                    position: g.position
                })),
                settings: {
                    drawingHeight: state.drawingHeight,
                    planeRotation: state.planeRotation,
                    particleType: state.particleType,
                    particleColor: state.particleColor,
                    cameraSensitivity: state.cameraSensitivity,
                    gridSize: state.gridSize
                }
            };

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(autoSaveData));
            console.log('[LocalStorage] 自動儲存完成:', new Date().toLocaleTimeString());

        } catch (error) {
            console.error('[LocalStorage] 自動儲存失敗:', error);
            if (error.name === 'QuotaExceededError') {
                alert('瀏覽器儲存空間已滿，請匯出專案檔案後清除部分資料。');
            }
        }
    }

    // 從 localStorage 載入
    loadAutoSave() {
        try {
            const savedData = localStorage.getItem(this.STORAGE_KEY);

            if (!savedData) {
                console.log('[LocalStorage] 沒有找到自動儲存的資料');
                return false;
            }

            const autoSaveData = JSON.parse(savedData);
            const savedTime = new Date(autoSaveData.timestamp);
            const timeDiff = Date.now() - savedTime.getTime();
            const hoursDiff = timeDiff / (1000 * 60 * 60);

            // 如果自動儲存超過24小時，詢問是否載入
            if (hoursDiff > 24) {
                const shouldLoad = confirm(
                    `找到 ${hoursDiff.toFixed(1)} 小時前的自動儲存資料\n` +
                    `專案名稱: ${autoSaveData.projectName}\n` +
                    `粒子數量: ${autoSaveData.particles.length}\n\n` +
                    `是否要載入？`
                );

                if (!shouldLoad) {
                    return false;
                }
            } else {
                console.log(`[LocalStorage] 載入 ${Math.round(timeDiff / 1000)} 秒前的自動儲存`);
            }

            // 構建專案資料格式
            const projectData = {
                name: autoSaveData.projectName || '自動儲存',
                particles: autoSaveData.particles || [],
                groups: autoSaveData.groups || [],
                settings: autoSaveData.settings || {}
            };

            this.stateManager.loadProject(projectData);
            console.log('[LocalStorage] 自動儲存資料已載入');
            return true;

        } catch (error) {
            console.error('[LocalStorage] 載入自動儲存失敗:', error);
            return false;
        }
    }

    // 清除自動儲存
    clearAutoSave() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('[LocalStorage] 自動儲存已清除');
            return true;
        } catch (error) {
            console.error('[LocalStorage] 清除自動儲存失敗:', error);
            return false;
        }
    }

    // 儲存使用者設定（不會自動清除）
    saveSettings(settings) {
        try {
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
            console.log('[LocalStorage] 使用者設定已儲存');
        } catch (error) {
            console.error('[LocalStorage] 儲存設定失敗:', error);
        }
    }

    // 載入使用者設定
    loadSettings() {
        try {
            const settings = localStorage.getItem(this.SETTINGS_KEY);
            return settings ? JSON.parse(settings) : null;
        } catch (error) {
            console.error('[LocalStorage] 載入設定失敗:', error);
            return null;
        }
    }

    // 取得儲存空間使用情況
    getStorageInfo() {
        try {
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length + key.length;
                }
            }

            // localStorage 通常限制在 5-10MB
            const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
            const estimatedLimit = 5; // MB
            const usage = ((totalSize / (estimatedLimit * 1024 * 1024)) * 100).toFixed(1);

            return {
                totalSize: totalSizeMB,
                usage: usage,
                hasAutoSave: !!localStorage.getItem(this.STORAGE_KEY)
            };
        } catch (error) {
            console.error('[LocalStorage] 取得儲存資訊失敗:', error);
            return null;
        }
    }
}

export default LocalStorageManager;
