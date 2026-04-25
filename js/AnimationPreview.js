/**
 * AnimationPreview - 動畫預覽
 * 依 tick 順序隱藏再逐步顯示粒子，模擬 MythicMobs -delay 的呈現效果
 * 1 tick = 50ms (Minecraft 20 tps)
 */
const TICK_MS = 50;
const END_HOLD_MS = 600;

class AnimationPreview {
    constructor(stateManager, sceneSync) {
        this.stateManager = stateManager;
        this.sceneSync = sceneSync;
        this.isPlaying = false;
        this.timers = [];
        this.touchedMeshes = [];
        this.onStart = null;
        this.onEnd = null;
    }

    isRunning() {
        return this.isPlaying;
    }

    /**
     * 開始播放預覽動畫
     * 依 state.animationTickInterval 的 tick 數逐群組顯示
     */
    play() {
        if (this.isPlaying) return false;

        const state = this.stateManager.getState();
        if (!state.animationEnabled) return false;
        const tickFloat = parseFloat(state.animationTickInterval);
        const tickInterval = Number.isFinite(tickFloat) && tickFloat > 0 ? tickFloat : 1;

        const byTick = this._collectMeshesByTick(state, tickInterval);
        if (byTick.size === 0) return false;

        this.isPlaying = true;
        this.touchedMeshes = [];

        // 先全部隱藏
        for (const meshes of byTick.values()) {
            meshes.forEach(mesh => {
                if (mesh) {
                    mesh.visible = false;
                    this.touchedMeshes.push(mesh);
                }
            });
        }

        if (this.onStart) this.onStart();

        // 依 tick 順序排程顯示
        const sortedTicks = Array.from(byTick.keys()).sort((a, b) => a - b);
        const baseTick = sortedTicks[0];
        let maxDelayMs = 0;

        sortedTicks.forEach(tick => {
            const delayMs = (tick - baseTick) * TICK_MS;
            maxDelayMs = Math.max(maxDelayMs, delayMs);
            const meshes = byTick.get(tick);
            const timerId = setTimeout(() => {
                meshes.forEach(mesh => {
                    if (mesh) mesh.visible = true;
                });
            }, delayMs);
            this.timers.push(timerId);
        });

        // 播完後稍停一下再結束
        const endTimer = setTimeout(() => {
            this._finish();
        }, maxDelayMs + END_HOLD_MS);
        this.timers.push(endTimer);

        return true;
    }

    /**
     * 立即停止預覽，還原所有粒子為可見
     */
    stop() {
        if (!this.isPlaying) return;
        this._finish();
    }

    _finish() {
        this.timers.forEach(id => clearTimeout(id));
        this.timers = [];
        this.touchedMeshes.forEach(mesh => {
            if (mesh) mesh.visible = true;
        });
        this.touchedMeshes = [];
        this.isPlaying = false;
        if (this.onEnd) this.onEnd();
    }

    /**
     * 掃描 sceneSync 中的 mesh，依 tick 分群
     * 規則與 CodeGenerator 一致：
     *   - 靜態（isAnimated=false）群組與獨立粒子點不會被隱藏，全程可見
     *   - 動畫群組：每個粒子 index * tickInterval 為顯示的 tick
     */
    _collectMeshesByTick(state, tickInterval) {
        const byTick = new Map();
        const quantize = t => Math.round(t * 100) / 100;
        const add = (tick, mesh) => {
            if (!mesh) return;
            const key = quantize(tick);
            if (!byTick.has(key)) byTick.set(key, []);
            byTick.get(key).push(mesh);
        };

        // 獨立粒子點視為靜態，不納入動畫隱藏列表
        // 繪圖群組：僅動畫群組依 tick 排入；若群組有自己的 tickInterval 則優先使用
        state.drawingGroups.forEach(groupData => {
            if (!groupData.isAnimated) return;
            const group = this.sceneSync.getGroup(groupData.id);
            if (!group || !group.meshes) return;
            const groupTickFloat = parseFloat(groupData.tickInterval);
            const interval = Number.isFinite(groupTickFloat) && groupTickFloat > 0 ? groupTickFloat : tickInterval;
            group.meshes.forEach((mesh, index) => {
                add(index * interval, mesh);
            });
        });

        return byTick;
    }
}

export default AnimationPreview;
