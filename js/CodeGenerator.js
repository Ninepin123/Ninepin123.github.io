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
        const skillLines = [`${skillId}:`, '  Skills:'];

        // 從個別粒子點生成程式碼
        state.particlePoints.forEach(point => {
            skillLines.push(this.buildParticleLine(point));
        });

        // 從繪圖群組生成程式碼
        state.drawingGroups.forEach(group => {
            if (group.particles && group.particles.length > 0) {
                group.particles.forEach(point => {
                    skillLines.push(this.buildParticleLine(point));
                });
            }
        });

        this.codeOutput.value = skillLines.join('\n');

        // 自動下載 .yml 檔案
        this.download(`${skillId}.yml`, this.codeOutput.value);
    }

    buildParticleLine(point) {
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
        return `    - effect:particles{${attributes.join(';')}} @self`;
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
