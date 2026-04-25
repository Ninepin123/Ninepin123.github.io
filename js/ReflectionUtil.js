/**
 * 反射 (鏡像) 工具：將粒子點對 XZ 平面上的線段鏡子做鏡像。
 * 鏡子格式: { id, x1, z1, x2, z2 }（線段為一條從 (x1,z1) 到 (x2,z2) 的無限延伸鏡面）
 * 鏡像時 Y 不變，僅在 XZ 平面對鏡子直線做鏡射。
 */

function reflectPointAcrossLine(x, z, x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-9) return { x, z };

    // 點到鏡面直線的投影參數 t
    const t = ((x - x1) * dx + (z - z1) * dz) / lenSq;
    const projX = x1 + t * dx;
    const projZ = z1 + t * dz;

    return {
        x: 2 * projX - x,
        z: 2 * projZ - z
    };
}

/**
 * 將一組粒子根據鏡子陣列展開：每加入一面鏡子，現有粒子集合會額外多一份鏡像副本。
 * N 面鏡子最多會產生 2^N 倍粒子數。
 *
 * @param {Array} particles - 原始粒子陣列（{id?, x, y, z, particleType, color}）
 * @param {Array} mirrors - 鏡子陣列
 * @returns {Array} 展開後的粒子陣列（含原始 + 鏡像）
 */
export function reflectParticles(particles, mirrors) {
    if (!Array.isArray(mirrors) || mirrors.length === 0) {
        return particles.slice();
    }

    let result = particles.slice();

    for (const mirror of mirrors) {
        const additions = [];
        for (const p of result) {
            const r = reflectPointAcrossLine(p.x, p.z, mirror.x1, mirror.z1, mirror.x2, mirror.z2);
            additions.push({
                ...p,
                id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${p.id || 'p'}_m_${mirror.id}`,
                x: r.x,
                y: p.y,
                z: r.z
            });
        }
        result = result.concat(additions);
    }

    return result;
}

/**
 * 對單一粒子做所有鏡子的鏡像展開。
 * 用在筆刷增量繪製時：每描一個新點，需要產生對應的所有鏡像點。
 */
export function reflectSingleParticle(particle, mirrors) {
    return reflectParticles([particle], mirrors);
}
