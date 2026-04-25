class CodeGenerator {
    constructor(stateManager, codeOutput, copyCodeBtn) {
        this.stateManager = stateManager;
        this.codeOutput = codeOutput;
        this.copyCodeBtn = copyCodeBtn;
    }

    generate() {
        const state = this.stateManager.getState();
        if (state.particlePoints.length === 0 && state.drawingGroups.length === 0) {
            this.codeOutput.value = "畫布上沒有任何粒子點，請先點擊繪製！";
            return;
        }

        const skillId = state.skillId || 'MyDrawingSkill';
        const animationEnabled = !!state.animationEnabled;
        const globalTickFloat = parseFloat(state.animationTickInterval);
        const globalTick = Number.isFinite(globalTickFloat) && globalTickFloat > 0 ? globalTickFloat : 1;
        const skillLines = [`${skillId}:`, '  Skills:'];

        // 收集動畫粒子（依 tick 分群）與靜態粒子
        // 用量化過的 tick 當 Map key，避免浮點誤差導致同 tick 沒被合併
        const byTick = new Map();
        const staticParticles = [];
        const quantize = t => Math.round(t * 100) / 100;
        const addToTick = (tick, point) => {
            const key = quantize(tick);
            if (!byTick.has(key)) byTick.set(key, []);
            byTick.get(key).push(point);
        };

        // 獨立粒子點：無 isAnimated 標記，視為靜態
        state.particlePoints.forEach(point => staticParticles.push(point));

        // 繪圖群組：依群組的 isAnimated 決定歸類；若群組有自己的 tickInterval 則優先使用
        state.drawingGroups.forEach(group => {
            if (!group.particles || group.particles.length === 0) return;
            const animatedGroup = animationEnabled && !!group.isAnimated;
            if (animatedGroup) {
                const groupTickFloat = parseFloat(group.tickInterval);
                const tickInterval = Number.isFinite(groupTickFloat) && groupTickFloat > 0 ? groupTickFloat : globalTick;
                group.particles.forEach((point, index) => {
                    addToTick(index * tickInterval, point);
                });
            } else {
                group.particles.forEach(point => staticParticles.push(point));
            }
        });

        const ticks = Array.from(byTick.keys()).sort((a, b) => a - b);

        if (ticks.length === 0) {
            // 沒有動畫粒子：全部直接輸出
            staticParticles.forEach(point => {
                skillLines.push(this.buildParticleLine(point, null));
            });
        } else {
            // 有動畫粒子：每個 tick 群組先印靜態、再印該 tick 的動畫粒子
            ticks.forEach((tick, i) => {
                if (i > 0) {
                    const delta = quantize(tick - ticks[i - 1]);
                    const deltaStr = Number.isInteger(delta) ? String(delta) : delta.toFixed(2);
                    skillLines.push(`    - delay ${deltaStr}`);
                }
                staticParticles.forEach(point => {
                    skillLines.push(this.buildParticleLine(point, null));
                });
                byTick.get(tick).forEach(point => {
                    skillLines.push(this.buildParticleLine(point, null));
                });
            });
        }

        this.codeOutput.value = skillLines.join('\n');

        // 自動下載 .yml 檔案
        this.download(`${skillId}.yml`, this.codeOutput.value);
    }

    buildParticleLine(point, delay = null) {
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
        const suffix = (delay !== null && delay !== undefined) ? ` -delay ${delay}` : '';
        return `    - effect:particles{${attributes.join(';')}} @self${suffix}`;
    }

    copy() {
        const code = this.codeOutput.value;
        if (!code || code.trim() === "" || code === "畫布上沒有任何粒子點，請先點擊繪製！") {
            this.generate();
            const newCode = this.codeOutput.value;
            if (!newCode || newCode.trim() === "" || newCode === "畫布上沒有任何粒子點，請先點擊繪製！") {
                this.showCopyFeedback('沒有可複製的內容！', false);
                return;
            }
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(this.codeOutput.value).then(() => {
                this.showCopyFeedback('已複製！', true);
            }).catch(err => {
                console.error('無法複製程式碼: ', err);
                this.fallbackCopyTextToClipboard(this.codeOutput.value);
            });
        } else {
            this.fallbackCopyTextToClipboard(this.codeOutput.value);
        }
    }

    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
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

    showCopyFeedback(message, success) {
        const originalText = this.copyCodeBtn.textContent;
        this.copyCodeBtn.textContent = message;
        this.copyCodeBtn.style.backgroundColor = success ? '#28a745' : '#dc3545';

        setTimeout(() => {
            this.copyCodeBtn.textContent = originalText;
            this.copyCodeBtn.style.backgroundColor = '';
        }, 1500);
    }

    download(filename, content) {
        const element = document.createElement('a');
        const file = new Blob([content], { type: 'text/yaml' });
        element.href = URL.createObjectURL(file);
        element.download = filename;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    clearOutput() {
        if (this.codeOutput.value) this.codeOutput.value = '';
    }
}

export default CodeGenerator;
