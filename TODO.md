# MythicParticle3D Editor - 開發待辦清單

## 📊 整體進度：21/29 任務完成 (72%)

---

## ✅ 已完成功能

### 階段一：基礎架構與儲存系統 (9/9 完成)

- [x] 研究現有程式碼結構和繪圖實作
- [x] 新增技能ID輸入欄位到UI
- [x] 新增網格大小調整欄位到UI (5-50)
- [x] 更新 `StateManager` 支援技能ID和網格大小
- [x] 更新 `UIManager` 處理新欄位事件
- [x] 更新程式碼生成使用自訂技能ID
- [x] 更新 `ProjectManager` 儲存/載入技能ID與網格大小
- [x] 更新 `ThreeScene` 支援動態調整網格大小
- [x] 實作 `LocalStorageManager` 自動儲存功能
  - 每2秒自動儲存
  - 頁面關閉前提醒
  - 自動載入上次工作

### 階段二：群組繪圖系統 (4/4 完成)

- [x] 創建 `DrawingGroup` 核心類別
  - 支援邊界計算
  - 支援群組移動和縮放
  - 支援序列化/反序列化
- [x] 重構筆刷功能為群組系統
  - 每一筆自由繪製自動成為一個群組
  - 支援連續繪製
- [x] 實作矩形繪製工具
  - 拖拽繪製
  - 即時預覽
  - 自動填充粒子
- [x] 實作圓形繪製工具
  - 拖拽繪製
  - 即時預覽
  - 自動填充粒子

---

## 🎯 待完成功能

### 階段三：群組選擇與編輯 (4/5 完成)

#### 選擇功能
- [x] 實作 raycasting 群組選擇
  - 在選擇模式下點擊可選中群組
  - 支援點擊空白處取消選擇
  - [x] 支援框選多選（拖曳矩形）
    - 顯示螢幕矩形覆蓋層
    - 將群組中心投影到螢幕判定是否在矩形內
    - 多群組同時拖動並提交狀態

- [x] 選中時顯示視覺反饋
  - 顯示綠色邊界框
  - 高亮選中的群組

#### 拖動功能
- [x] 實作選擇模式下的群組拖動
  - 拖動選中的群組移動位置
  - 即時更新3D場景

- [x] 拖動時更新群組內所有粒子位置
  - 保持相對位置關係
  - 更新 StateManager 中的資料

- [ ] 測試並修復群組系統的bug
  - 測試各種邊界情況
  - 確保序列化正確
  - [x] 修正拖動後選取錯位/碰撞箱不同步問題（相機方向拖動平面 + ray/Box3 命中）

**檔案位置：**
- `main.js` - handleMouseDown/Move/Up 添加選擇模式邏輯
- `DrawingGroup.js` - 已有 moveTo() 方法

---

### 階段四：群組縮放功能 (0/3 完成)

- [ ] 創建選中群組的8個縮放控制點
  - 四個角點 + 四個邊中點
  - 使用橘色小球體顯示

- [ ] 實作縮放控制點互動
  - 拖動控制點改變群組大小
  - 支援等比例/非等比例縮放

- [ ] 縮放時調整群組內所有粒子
  - 相對於群組中心點縮放
  - 保持粒子分布密度

**檔案位置：**
- `DrawingGroup.js` - 已有 createResizeHandles() 方法
- `main.js` - 需添加控制點拖動邏輯

---

### 階段五：自訂游標系統 (4/5 完成)

- [x] 創建游標樣式管理器 `CursorManager.js`
  - 管理不同工具的游標樣式 
  - 支援動態切換

- [x] 筆刷工具游標
  - 顯示圓形筆刷圖示
  - 圖示大小與筆刷範圍對應

- [x] 橡皮擦工具游標
  - 顯示橡皮擦圖示
  - 圖示大小與擦除範圍對應

- [x] 形狀工具游標
  - 矩形：顯示十字準星 + 方框圖示
  - 圓形：顯示十字準星 + 圓圈圖示

- [ ] 選擇模式游標
  - 懸停在群組上：顯示手型游標
  - 懸停在控制點：顯示調整大小游標

**實作方式：**
```javascript
// 使用 CSS cursor 屬性
canvas.style.cursor = 'url(cursor-image.svg), auto';
```

---

### 階段六：粒子預覽系統 (0/3 完成)

- [ ] 實作筆刷的粒子預覽圓圈
  - 顯示半透明圓圈表示筆刷範圍
  - 跟隨滑鼠移動
  - 顯示預計會繪製的位置

- [ ] 實作橡皮擦的粒子預覽圓圈
  - 顯示半透明紅色圓圈表示擦除範圍
  - 跟隨滑鼠移動
  - 高亮會被刪除的粒子

- [ ] 滑鼠移動時更新預覽覆蓋層位置
  - 使用 2D Canvas overlay 或 3D mesh
  - 保持與繪圖平面對齊

**實作方式：**
```javascript
// 使用 THREE.Mesh 作為預覽
const previewGeometry = new THREE.CircleGeometry(radius, 32);
const previewMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ff00,
  transparent: true,
  opacity: 0.3
});
```

**檔案位置：**
- `main.js` - handleMouseMove 添加預覽邏輯
- `ThreeScene.js` - 添加預覽物件管理方法

---

## 📁 專案結構

```
MythicParticle3Deditor/
├── index.html              # 主頁面
├── main.js                 # 應用程式入口點
├── style.css               # 樣式表
├── js/
│   ├── StateManager.js           # ✅ 狀態管理（已更新）
│   ├── ThreeScene.js             # ✅ Three.js場景管理（已更新）
│   ├── UIManager.js              # ✅ UI控制（已更新）
│   ├── ProjectManager.js         # ✅ 專案存檔（已更新）
│   ├── LocalStorageManager.js   # ✅ 本地儲存（新增）
│   ├── DrawingGroup.js           # ✅ 繪圖群組類別（新增）
│   └── CursorManager.js          # ⏳ 游標管理（待建立）
└── TODO.md                 # 本檔案
```

---

## 🔧 開發指南

### 優先順序建議

1. **高優先級：** 群組選擇與拖動（階段三）
   - 這是核心互動功能
   - 完成後可以驗證群組系統是否正常運作

2. **中優先級：** 群組縮放功能（階段四）
   - 提供完整的編輯能力
   - DrawingGroup 類別已有基礎方法

3. **低優先級：** UI/UX 優化（階段五、六）
   - 改善使用者體驗
   - 不影響核心功能

### 測試建議

在完成每個階段後，測試以下情況：

- [ ] 繪製多個群組（點、筆刷、矩形、圓形）
- [ ] 選擇不同的群組
- [ ] 拖動群組到不同位置
- [ ] 調整群組大小
- [ ] 儲存專案並重新載入
- [ ] localStorage 自動儲存恢復
- [ ] 生成 MythicMobs 程式碼正確性

---

## 📝 變更日誌

### 2024-01-XX - 階段一、二完成
- ✅ 完成基礎架構
- ✅ 實作群組繪圖系統
- ✅ 實作形狀繪製工具
- ✅ 實作自動儲存功能

### 待更新...
- ⏳ 群組選擇與編輯
- ⏳ 群組縮放功能
- ⏳ 游標與預覽系統

---

## 💡 技術備註

### 群組系統架構

每個 `DrawingGroup` 包含：
- `id`: 唯一識別碼
- `type`: 類型（'point', 'brush', 'rectangle', 'circle'）
- `particles`: 粒子陣列
- `bounds`: 邊界框（min/max）
- `position`: 群組中心點
- `meshes`: 3D物件參考
- `boundingBox`: 邊界框視覺物件
- `resizeHandles`: 縮放控制點

### raycasting 選擇實作提示

```javascript
// 使用 THREE.Raycaster 檢測點擊
this.raycaster.setFromCamera(this.mouse, this.camera);

// 檢查是否點擊到群組的粒子
for (const [groupId, group] of this.groupObjectMap) {
  const intersects = this.raycaster.intersectObjects(group.meshes);
  if (intersects.length > 0) {
    // 選中此群組
    this.selectGroup(groupId);
    break;
  }
}
```

---

## 🎯 最終目標

打造一個功能完整的 MythicMobs 粒子特效 3D 編輯器，支援：
- ✅ 多種繪圖工具
- ✅ 群組管理系統
- ⏳ 完整的編輯功能
- ⏳ 直覺的使用者介面
- ✅ 自動儲存與專案管理
- ✅ 可自訂的技能ID與場景設定
