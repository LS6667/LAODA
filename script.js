// 模块化计算器 - 主应用程序
class ModularCalculator {
    constructor() {
        this.modules = [];
        this.connections = [];
        this.selectedModuleId = null;
        this.moduleCounter = 0;
        this.lastCalculationTime = null;
        this.isDarkTheme = false;
        this.history = [];
        
        this.init();
    }
    
    init() {
        // 隐藏加载动画，显示主界面
        setTimeout(() => {
            document.getElementById('loading').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('mainContainer').classList.add('loaded');
            }, 300);
        }, 1000);
        
        this.setupEventListeners();
        this.loadFromLocalStorage();
        this.updateUI();
        this.simulateCPUUsage();
        this.showWelcomeMessage();
    }
    
    setupEventListeners() {
        // 主题切换
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // 新建项目
        document.getElementById('newProjectBtn').addEventListener('click', () => this.newProject());
        
        // 清空工作区
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearWorkspace());
        
        // 执行所有计算
        document.getElementById('calculateAllBtn').addEventListener('click', () => this.calculateAll());
        
        // 添加示例
        document.getElementById('addExampleBtn').addEventListener('click', () => this.addExample());
        
        // 导出配置
        document.getElementById('exportBtn').addEventListener('click', () => this.exportConfig());
        
        // 导入配置
        document.getElementById('importBtn').addEventListener('click', () => this.importConfig());
        
        // 保存项目
        document.getElementById('saveProjectBtn').addEventListener('click', () => this.saveProject());
        
        // 帮助按钮
        document.getElementById('helpBtn').addEventListener('click', () => this.showHelp());
        
        // 关闭属性面板
        document.getElementById('closeProperties').addEventListener('click', () => this.closeProperties());
        
        // 关闭模态框
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        
        // 模块搜索
        document.getElementById('moduleSearch').addEventListener('input', (e) => this.filterModules(e.target.value));
        
        // 模块卡片点击
        document.querySelectorAll('.module-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const type = e.currentTarget.getAttribute('data-type');
                this.addModule(type);
            });
            
            // 拖拽功能
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('moduleType', e.currentTarget.getAttribute('data-type'));
                e.currentTarget.classList.add('dragging');
            });
            
            card.addEventListener('dragend', (e) => {
                e.currentTarget.classList.remove('dragging');
            });
        });
        
        // 工作区拖放
        const workspace = document.getElementById('workspaceArea');
        workspace.addEventListener('dragover', (e) => {
            e.preventDefault();
            workspace.classList.add('drag-over');
        });
        
        workspace.addEventListener('dragleave', () => {
            workspace.classList.remove('drag-over');
        });
        
        workspace.addEventListener('drop', (e) => {
            e.preventDefault();
            workspace.classList.remove('drag-over');
            
            const moduleType = e.dataTransfer.getData('moduleType');
            if (moduleType) {
                const rect = workspace.getBoundingClientRect();
                const x = e.clientX - rect.left - 110;
                const y = e.clientY - rect.top - 50;
                this.addModule(moduleType, x, y);
            }
        });
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            // Ctrl+S 保存
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveProject();
            }
            
            // Delete 键删除选中模块
            if (e.key === 'Delete' && this.selectedModuleId) {
                this.deleteModule(this.selectedModuleId);
            }
            
            // Ctrl+Z 撤销
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
            
            // Ctrl+Y 重做
            if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }
            
            // Escape 取消选择
            if (e.key === 'Escape') {
                this.selectModule(null);
            }
        });
        
        // 窗口大小变化
        window.addEventListener('resize', () => this.updateConnections());
    }
    
    // 模块定义
    moduleDefinitions = {
        'number-input': {
            name: '数字输入',
            color: '#3498db',
            icon: '<i class="fas fa-font"></i>',
            inputs: 0,
            outputs: 1,
            createBody: (id) => `
                <div class="output-group">
                    <label>数值</label>
                    <input type="number" class="input-field" value="0" 
                           data-module="${id}" data-output="0" step="any">
                </div>
            `,
            calculate: (module) => {
                const input = document.querySelector(`input[data-module="${module.id}"][data-output="0"]`);
                return parseFloat(input.value) || 0;
            }
        },
        
        'slider-input': {
            name: '滑块输入',
            color: '#9b59b6',
            icon: '<i class="fas fa-sliders-h"></i>',
            inputs: 0,
            outputs: 1,
            createBody: (id) => `
                <div class="output-group">
                    <label>值: <span id="sliderValue-${id}">50</span></label>
                    <input type="range" class="input-field" min="0" max="100" value="50" 
                           data-module="${id}" data-output="0" id="slider-${id}">
                </div>
            `,
            calculate: (module) => {
                const slider = document.getElementById(`slider-${module.id}`);
                return parseFloat(slider.value) || 0;
            }
        },
        
        'toggle-input': {
            name: '开关输入',
            color: '#2ecc71',
            icon: '<i class="fas fa-toggle-on"></i>',
            inputs: 0,
            outputs: 1,
            createBody: (id) => `
                <div class="output-group">
                    <label>状态</label>
                    <div class="toggle-switch">
                        <input type="checkbox" id="toggle-${id}" data-module="${id}" data-output="0" checked>
                        <label for="toggle-${id}" class="toggle-label"></label>
                    </div>
                </div>
            `,
            calculate: (module) => {
                const toggle = document.getElementById(`toggle-${module.id}`);
                return toggle.checked ? 1 : 0;
            }
        },
        
        'addition': {
            name: '加法器',
            color: '#2ecc71',
            icon: '<i class="fas fa-plus"></i>',
            inputs: 2,
            outputs: 1,
            createBody: (id) => `
                <div class="input-group">
                    <label>输入 A</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="0" step="any">
                </div>
                <div class="input-group">
                    <label>输入 B</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="1" step="any">
                </div>
                <div class="output-group">
                    <label>结果 (A + B)</label>
                    <div class="output-value" data-module="${id}" data-output="0">0</div>
                </div>
            `,
            calculate: (module) => {
                const inputA = this.getInputValue(module, 0);
                const inputB = this.getInputValue(module, 1);
                return (inputA + inputB).toFixed(2);
            }
        },
        
        'subtraction': {
            name: '减法器',
            color: '#e74c3c',
            icon: '<i class="fas fa-minus"></i>',
            inputs: 2,
            outputs: 1,
            createBody: (id) => `
                <div class="input-group">
                    <label>输入 A</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="0" step="any">
                </div>
                <div class="input-group">
                    <label>输入 B</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="1" step="any">
                </div>
                <div class="output-group">
                    <label>结果 (A - B)</label>
                    <div class="output-value" data-module="${id}" data-output="0">0</div>
                </div>
            `,
            calculate: (module) => {
                const inputA = this.getInputValue(module, 0);
                const inputB = this.getInputValue(module, 1);
                return (inputA - inputB).toFixed(2);
            }
        },
        
        'multiplication': {
            name: '乘法器',
            color: '#f39c12',
            icon: '<i class="fas fa-times"></i>',
            inputs: 2,
            outputs: 1,
            createBody: (id) => `
                <div class="input-group">
                    <label>输入 A</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="0" step="any">
                </div>
                <div class="input-group">
                    <label>输入 B</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="1" step="any">
                </div>
                <div class="output-group">
                    <label>结果 (A × B)</label>
                    <div class="output-value" data-module="${id}" data-output="0">0</div>
                </div>
            `,
            calculate: (module) => {
                const inputA = this.getInputValue(module, 0);
                const inputB = this.getInputValue(module, 1);
                return (inputA * inputB).toFixed(2);
            }
        },
        
        'division': {
            name: '除法器',
            color: '#1abc9c',
            icon: '<i class="fas fa-divide"></i>',
            inputs: 2,
            outputs: 1,
            createBody: (id) => `
                <div class="input-group">
                    <label>被除数 (A)</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="0" step="any">
                </div>
                <div class="input-group">
                    <label>除数 (B)</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="1" step="any">
                </div>
                <div class="output-group">
                    <label>结果 (A ÷ B)</label>
                    <div class="output-value" data-module="${id}" data-output="0">0</div>
                </div>
            `,
            calculate: (module) => {
                const inputA = this.getInputValue(module, 0);
                const inputB = this.getInputValue(module, 1);
                if (inputB === 0) return "错误: 除零";
                return (inputA / inputB).toFixed(2);
            }
        },
        
        'percentage': {
            name: '百分比计算',
            color: '#9b59b6',
            icon: '<i class="fas fa-percentage"></i>',
            inputs: 2,
            outputs: 1,
            createBody: (id) => `
                <div class="input-group">
                    <label>数值</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="0" step="any">
                </div>
                <div class="input-group">
                    <label>百分比 (%)</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="1" step="any">
                </div>
                <div class="output-group">
                    <label>结果</label>
                    <div class="output-value" data-module="${id}" data-output="0">0</div>
                </div>
            `,
            calculate: (module) => {
                const value = this.getInputValue(module, 0);
                const percentage = this.getInputValue(module, 1);
                return (value * percentage / 100).toFixed(2);
            }
        },
        
        'average': {
            name: '平均值计算',
            color: '#34495e',
            icon: '<i class="fas fa-chart-bar"></i>',
            inputs: 3,
            outputs: 1,
            createBody: (id) => `
                <div class="input-group">
                    <label>数值 A</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="0" step="any">
                </div>
                <div class="input-group">
                    <label>数值 B</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="1" step="any">
                </div>
                <div class="input-group">
                    <label>数值 C</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="2" step="any">
                </div>
                <div class="output-group">
                    <label>平均值</label>
                    <div class="output-value" data-module="${id}" data-output="0">0</div>
                </div>
            `,
            calculate: (module) => {
                const sum = this.getInputValue(module, 0) + 
                           this.getInputValue(module, 1) + 
                           this.getInputValue(module, 2);
                return (sum / 3).toFixed(2);
            }
        },
        
        'power': {
            name: '幂运算',
            color: '#e67e22',
            icon: '<i class="fas fa-superscript"></i>',
            inputs: 2,
            outputs: 1,
            createBody: (id) => `
                <div class="input-group">
                    <label>底数 (x)</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="0" step="any">
                </div>
                <div class="input-group">
                    <label>指数 (y)</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="1" step="any">
                </div>
                <div class="output-group">
                    <label>结果 (x^y)</label>
                    <div class="output-value" data-module="${id}" data-output="0">0</div>
                </div>
            `,
            calculate: (module) => {
                const base = this.getInputValue(module, 0);
                const exponent = this.getInputValue(module, 1);
                return Math.pow(base, exponent).toFixed(2);
            }
        },
        
        'square-root': {
            name: '平方根',
            color: '#2c3e50',
            icon: '<i class="fas fa-square-root-alt"></i>',
            inputs: 1,
            outputs: 1,
            createBody: (id) => `
                <div class="input-group">
                    <label>数值 (x)</label>
                    <input type="number" class="input-field" placeholder="自动或手动输入" 
                           data-module="${id}" data-input="0" step="any" min="0">
                </div>
                <div class="output-group">
                    <label>结果 (√x)</label>
                    <div class="output-value" data-module="${id}" data-output="0">0</div>
                </div>
            `,
            calculate: (module) => {
                const value = this.getInputValue(module, 0);
                if (value < 0) return "错误: 负数";
                return Math.sqrt(value).toFixed(2);
            }
        }
    };
    
    // 添加模块到工作区
    addModule(type, x = null, y = null) {
        this.moduleCounter++;
        const id = `module-${this.moduleCounter}`;
        const definition = this.moduleDefinitions[type];
        
        if (!definition) {
            this.showNotification('未知模块类型', 'error');
            return;
        }
        
        // 如果未指定位置，放在工作区中心
        const workspace = document.getElementById('workspaceArea');
        if (x === null || y === null) {
            const rect = workspace.getBoundingClientRect();
            x = (rect.width - 220) / 2;
            y = (rect.height - 200) / 2;
        }
        
        // 创建模块对象
        const module = {
            id,
            type,
            name: definition.name,
            x,
            y,
            inputValues: new Array(definition.inputs).fill(0),
            outputValues: new Array(definition.outputs).fill(0)
        };
        
        this.modules.push(module);
        
        // 创建DOM元素
        const moduleElement = document.createElement('div');
        moduleElement.className = 'calc-module';
        moduleElement.id = id;
        moduleElement.style.left = `${x}px`;
        moduleElement.style.top = `${y}px`;
        moduleElement.innerHTML = `
            <div class="module-header" style="background: ${definition.color};">
                <div class="module-title">
                    ${definition.icon}
                    <span>${definition.name}</span>
                </div>
                <div class="module-actions">
                    <button class="btn btn-icon" data-action="delete" data-module="${id}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="module-body">
                ${definition.createBody(id)}
            </div>
        `;
        
        workspace.appendChild(moduleElement);
        
        // 隐藏空工作区提示
        document.getElementById('emptyWorkspace').classList.add('hidden');
        
        // 添加事件监听器
        this.setupModuleEvents(moduleElement, id, definition);
        
        // 初始计算
        this.calculateModule(id);
        
        // 添加到历史记录
        this.addHistory('添加模块', { type, id });
        
        // 更新UI
        this.updateUI();
        
        this.showNotification(`已添加 ${definition.name}`, 'success');
        
        return module;
    }
    
    // 设置模块事件
    setupModuleEvents(element, id, definition) {
        // 点击选择模块
        element.addEventListener('click', (e) => {
            if (!e.target.closest('[data-action="delete"]')) {
                this.selectModule(id);
            }
        });
        
        // 删除按钮
        const deleteBtn = element.querySelector('[data-action="delete"]');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteModule(id);
        });
        
        // 输入字段事件
        const inputFields = element.querySelectorAll('.input-field');
        inputFields.forEach(field => {
            field.addEventListener('input', () => {
                this.calculateModule(id);
                this.updateConnections();
            });
        });
        
        // 滑块特殊处理
        if (definition.type === 'slider-input') {
            const slider = document.getElementById(`slider-${id}`);
            const sliderValue = document.getElementById(`sliderValue-${id}`);
            
            slider.addEventListener('input', () => {
                sliderValue.textContent = slider.value;
                this.calculateModule(id);
                this.updateConnections();
            });
        }
        
        // 开关特殊处理
        if (definition.type === 'toggle-input') {
            const toggle = document.getElementById(`toggle-${id}`);
            toggle.addEventListener('change', () => {
                this.calculateModule(id);
                this.updateConnections();
            });
        }
        
        // 使模块可拖动
        this.makeDraggable(element, id);
    }
    
    // 使模块可拖动
    makeDraggable(element, id) {
        const header = element.querySelector('.module-header');
        let isDragging = false;
        let offsetX, offsetY;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('[data-action="delete"]')) return;
            
            isDragging = true;
            offsetX = e.clientX - element.offsetLeft;
            offsetY = e.clientY - element.offsetTop;
            
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
            
            e.preventDefault();
        });
        
        const drag = (e) => {
            if (!isDragging) return;
            
            const workspace = document.getElementById('workspaceArea');
            const rect = workspace.getBoundingClientRect();
            
            let x = e.clientX - offsetX;
            let y = e.clientY - offsetY;
            
            // 限制在工作区内
            const maxX = rect.width - element.clientWidth;
            const maxY = rect.height - element.clientHeight;
            
            x = Math.max(0, Math.min(x, maxX));
            y = Math.max(0, Math.min(y, maxY));
            
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
            
            // 更新模块位置
            const module = this.modules.find(m => m.id === id);
            if (module) {
                module.x = x;
                module.y = y;
            }
            
            this.updateConnections();
        };
        
        const stopDrag = () => {
            isDragging = false;
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
        };
    }
    
    // 获取模块输入值
    getInputValue(module, inputIndex) {
        // 检查连接
        for (const conn of this.connections) {
            if (conn.targetModule === module.id && conn.targetInput === inputIndex) {
                const sourceModule = this.modules.find(m => m.id === conn.sourceModule);
                if (sourceModule) {
                    return parseFloat(sourceModule.outputValues[conn.sourceOutput]) || 0;
                }
            }
        }
        
        // 检查输入字段
        const inputField = document.querySelector(`input[data-module="${module.id}"][data-input="${inputIndex}"]`);
        if (inputField) {
            return parseFloat(inputField.value) || 0;
        }
        
        return 0;
    }
    
    // 计算模块
    calculateModule(moduleId) {
        const module = this.modules.find(m => m.id === moduleId);
        if (!module) return;
        
        const definition = this.moduleDefinitions[module.type];
        if (!definition) return;
        
        try {
            const result = definition.calculate(module);
            module.outputValues[0] = result;
            
            // 更新UI
            const outputElement = document.querySelector(`.output-value[data-module="${moduleId}"]`);
            if (outputElement) {
                outputElement.textContent = result;
                
                if (typeof result === 'string' && result.includes('错误')) {
                    outputElement.style.color = 'var(--danger-color)';
                } else {
                    outputElement.style.color = '';
                }
            }
            
            // 更新依赖模块
            this.updateDependentModules(moduleId);
            
            this.lastCalculationTime = new Date();
            this.updateLastCalcTime();
            
        } catch (error) {
            console.error('计算错误:', error);
            this.showNotification(`计算错误: ${error.message}`, 'error');
        }
    }
    
    // 更新依赖模块
    updateDependentModules(moduleId) {
        for (const conn of this.connections) {
            if (conn.sourceModule === moduleId) {
                this.calculateModule(conn.targetModule);
            }
        }
    }
    
    // 执行所有计算
    calculateAll() {
        this.modules.forEach(module => {
            this.calculateModule(module.id);
        });
        
        this.updateConnections();
        this.showNotification('所有计算已完成', 'success');
        
        // 添加到历史记录
        this.addHistory('执行所有计算');
    }
    
    // 选择模块
    selectModule(moduleId) {
        this.selectedModuleId = moduleId;
        
        // 更新模块选中状态
        document.querySelectorAll('.calc-module').forEach(el => {
            el.classList.remove('selected');
        });
        
        if (moduleId) {
            const moduleElement = document.getElementById(moduleId);
            if (moduleElement) {
                moduleElement.classList.add('selected');
                this.showProperties(moduleId);
            }
        } else {
            this.showEmptyProperties();
        }
    }
    
    // 显示模块属性
    showProperties(moduleId) {
        const module = this.modules.find(m => m.id === moduleId);
        if (!module) return;
        
        const definition = this.moduleDefinitions[module.type];
        if (!definition) return;
        
        let propertiesHTML = `
            <div class="property-section">
                <h4><i class="fas fa-info-circle"></i> 基本信息</h4>
                <div class="property-item">
                    <label class="property-label">模块名称</label>
                    <input type="text" class="property-input module-name" 
                           value="${module.name}" data-module="${moduleId}">
                </div>
                <div class="property-item">
                    <label class="property-label">模块类型</label>
                    <input type="text" class="property-input" value="${definition.name}" readonly>
                </div>
                <div class="property-item">
                    <label class="property-label">位置</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="number" class="property-input" style="flex: 1;" 
                               value="${module.x}" data-property="x" data-module="${moduleId}">
                        <input type="number" class="property-input" style="flex: 1;" 
                               value="${module.y}" data-property="y" data-module="${moduleId}">
                    </div>
                </div>
            </div>
        `;
        
        // 输入配置
        if (definition.inputs > 0) {
            propertiesHTML += `
                <div class="property-section">
                    <h4><i class="fas fa-sign-in-alt"></i> 输入配置</h4>
            `;
            
            for (let i = 0; i < definition.inputs; i++) {
                propertiesHTML += `
                    <div class="property-item">
                        <label class="property-label">输入 ${String.fromCharCode(65 + i)}</label>
                        <input type="number" class="property-input module-input" 
                               data-module="${moduleId}" data-input="${i}" 
                               value="${module.inputValues[i] || 0}" step="any">
                    </div>
                `;
            }
            
            propertiesHTML += `</div>`;
        }
        
        // 输出值
        if (definition.outputs > 0) {
            propertiesHTML += `
                <div class="property-section">
                    <h4><i class="fas fa-sign-out-alt"></i> 输出值</h4>
            `;
            
            for (let i = 0; i < definition.outputs; i++) {
                propertiesHTML += `
                    <div class="property-item">
                        <label class="property-label">输出 ${i + 1}</label>
                        <input type="text" class="property-input" 
                               value="${module.outputValues[i] || 0}" readonly>
                    </div>
                `;
            }
            
            propertiesHTML += `</div>`;
        }
        
        // 操作按钮
        propertiesHTML += `
            <div class="property-section">
                <div class="workspace-controls" style="margin-top: 20px;">
                    <button class="btn btn-success" id="recalculateBtn" data-module="${moduleId}">
                        <i class="fas fa-redo"></i> 重新计算
                    </button>
                    <button class="btn btn-outline" id="cloneBtn" data-module="${moduleId}">
                        <i class="fas fa-clone"></i> 复制
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('propertyContent').innerHTML = propertiesHTML;
        
        // 添加事件监听器
        this.setupPropertyEvents(moduleId, definition);
        
        // 在移动设备上显示属性面板
        if (window.innerWidth <= 1200) {
            document.querySelector('.property-panel').classList.add('active');
        }
    }
    
    // 设置属性事件
    setupPropertyEvents(moduleId, definition) {
        // 模块名称
        const nameInput = document.querySelector('.module-name');
        nameInput.addEventListener('change', (e) => {
            const module = this.modules.find(m => m.id === moduleId);
            if (module) {
                module.name = e.target.value;
                
                // 更新模块标题
                const title = document.querySelector(`#${moduleId} .module-title span`);
                if (title) {
                    title.textContent = e.target.value;
                }
                
                this.addHistory('重命名模块', { id: moduleId, name: e.target.value });
            }
        });
        
        // 位置
        document.querySelectorAll('[data-property="x"], [data-property="y"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const module = this.modules.find(m => m.id === moduleId);
                if (module) {
                    const property = e.target.getAttribute('data-property');
                    module[property] = parseInt(e.target.value) || 0;
                    
                    const element = document.getElementById(moduleId);
                    if (element) {
                        element.style[property] = `${module[property]}px`;
                    }
                    
                    this.updateConnections();
                }
            });
        });
        
        // 输入字段
        document.querySelectorAll('.module-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const inputIndex = parseInt(e.target.getAttribute('data-input'));
                const module = this.modules.find(m => m.id === moduleId);
                if (module) {
                    module.inputValues[inputIndex] = parseFloat(e.target.value) || 0;
                    this.calculateModule(moduleId);
                    this.updateConnections();
                }
            });
        });
        
        // 重新计算按钮
        document.getElementById('recalculateBtn').addEventListener('click', () => {
            this.calculateModule(moduleId);
            this.showNotification('模块已重新计算', 'info');
        });
        
        // 复制按钮
        document.getElementById('cloneBtn').addEventListener('click', () => {
            this.cloneModule(moduleId);
        });
    }
    
    // 克隆模块
    cloneModule(moduleId) {
        const module = this.modules.find(m => m.id === moduleId);
        if (!module) return;
        
        const newModule = this.addModule(module.type, module.x + 30, module.y + 30);
        if (newModule) {
            newModule.name = `${module.name} (副本)`;
            newModule.inputValues = [...module.inputValues];
            
            // 更新UI
            const title = document.querySelector(`#${newModule.id} .module-title span`);
            if (title) {
                title.textContent = newModule.name;
            }
            
            // 复制输入值
            for (let i = 0; i < module.inputValues.length; i++) {
                const inputField = document.querySelector(`input[data-module="${newModule.id}"][data-input="${i}"]`);
                if (inputField) {
                    inputField.value = module.inputValues[i];
                }
            }
            
            this.calculateModule(newModule.id);
            this.showNotification(`已复制 ${module.name}`, 'success');
        }
    }
    
    // 显示空属性面板
    showEmptyProperties() {
        document.getElementById('propertyContent').innerHTML = `
            <div class="empty-properties">
                <div class="empty-icon">
                    <i class="fas fa-mouse-pointer"></i>
                </div>
                <h3>未选择模块</h3>
                <p>点击工作区中的模块以查看和编辑其属性</p>
            </div>
        `;
    }
    
    // 关闭属性面板
    closeProperties() {
        document.querySelector('.property-panel').classList.remove('active');
        this.selectModule(null);
    }
    
    // 删除模块
    deleteModule(moduleId) {
        const module = this.modules.find(m => m.id === moduleId);
        if (!module) return;
        
        if (confirm(`确定要删除 "${module.name}" 模块吗？`)) {
            // 从数组中移除
            this.modules = this.modules.filter(m => m.id !== moduleId);
            
            // 移除连接
            this.connections = this.connections.filter(c => 
                c.sourceModule !== moduleId && c.targetModule !== moduleId
            );
            
            // 移除DOM元素
            const element = document.getElementById(moduleId);
            if (element) {
                element.remove();
            }
            
            // 如果没有模块了，显示空工作区
            if (this.modules.length === 0) {
                document.getElementById('emptyWorkspace').classList.remove('hidden');
            }
            
            // 清除选择
            if (this.selectedModuleId === moduleId) {
                this.selectModule(null);
            }
            
            // 更新UI
            this.updateUI();
            this.updateConnections();
            
            // 添加到历史记录
            this.addHistory('删除模块', { id: moduleId, name: module.name });
            
            this.showNotification(`已删除 ${module.name}`, 'info');
        }
    }
    
    // 清空工作区
    clearWorkspace() {
        if (this.modules.length === 0) return;
        
        if (confirm('确定要清空工作区吗？所有模块和数据都将被删除。')) {
            // 移除所有模块
            this.modules.forEach(module => {
                const element = document.getElementById(module.id);
                if (element) element.remove();
            });
            
            this.modules = [];
            this.connections = [];
            this.selectedModuleId = null;
            
            // 显示空工作区
            document.getElementById('emptyWorkspace').classList.remove('hidden');
            this.showEmptyProperties();
            
            // 更新UI
            this.updateUI();
            this.updateConnections();
            
            // 添加到历史记录
            this.addHistory('清空工作区');
            
            this.showNotification('工作区已清空', 'info');
        }
    }
    
    // 新建项目
    newProject() {
        if (this.modules.length > 0) {
            if (!confirm('当前项目有未保存的更改。确定要新建项目吗？')) {
                return;
            }
        }
        
        this.clearWorkspace();
        this.showNotification('已创建新项目', 'success');
    }
    
    // 添加示例
    addExample() {
        this.clearWorkspace();
        
        // 添加示例模块
        const input1 = this.addModule('number-input', 50, 50);
        const input2 = this.addModule('number-input', 50, 200);
        const addition = this.addModule('addition', 300, 125);
        const percentage = this.addModule('percentage', 550, 125);
        
        // 设置示例数据
        if (input1 && input2 && addition && percentage) {
            // 设置输入值
            const input1Field = document.querySelector(`input[data-module="${input1.id}"][data-output="0"]`);
            const input2Field = document.querySelector(`input[data-module="${input2.id}"][data-output="0"]`);
            const percentageInput = document.querySelector(`input[data-module="${percentage.id}"][data-input="1"]`);
            
            if (input1Field) input1Field.value = 100;
            if (input2Field) input2Field.value = 50;
            if (percentageInput) percentageInput.value = 15;
            
            // 计算所有模块
            this.calculateAll();
            
            this.showNotification('已添加示例计算流程', 'success');
        }
    }
    
    // 导出配置
    exportConfig() {
        const config = {
            modules: this.modules.map(module => ({
                type: module.type,
                name: module.name,
                x: module.x,
                y: module.y,
                inputValues: module.inputValues,
                outputValues: module.outputValues
            })),
            connections: this.connections,
            version: '1.0',
            exportedAt: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(config, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `模块计算器配置_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.showNotification('配置已导出', 'success');
        this.addHistory('导出配置');
    }
    
    // 导入配置
    importConfig() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    
                    // 清空当前工作区
                    this.clearWorkspace();
                    
                    // 创建模块
                    config.modules.forEach(moduleConfig => {
                        const module = this.addModule(moduleConfig.type, moduleConfig.x, moduleConfig.y);
                        if (module) {
                            module.name = moduleConfig.name;
                            module.inputValues = moduleConfig.inputValues || [];
                            module.outputValues = moduleConfig.outputValues || [];
                            
                            // 更新UI
                            const title = document.querySelector(`#${module.id} .module-title span`);
                            if (title) {
                                title.textContent = module.name;
                            }
                            
                            // 设置输入值
                            moduleConfig.inputValues.forEach((value, index) => {
                                const inputField = document.querySelector(
                                    `input[data-module="${module.id}"][data-input="${index}"]`
                                );
                                if (inputField) {
                                    inputField.value = value;
                                }
                            });
                            
                            this.calculateModule(module.id);
                        }
                    });
                    
                    this.connections = config.connections || [];
                    this.updateConnections();
                    
                    this.showNotification('配置已导入', 'success');
                    this.addHistory('导入配置');
                    
                } catch (error) {
                    this.showNotification('导入失败：文件格式错误', 'error');
                    console.error(error);
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    // 保存项目到本地存储
    saveProject() {
        const project = {
            modules: this.modules,
            connections: this.connections,
            savedAt: new Date().toISOString()
        };
        
        localStorage.setItem('modularCalculatorProject', JSON.stringify(project));
        this.showNotification('项目已保存到本地', 'success');
    }
    
    // 从本地存储加载项目
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('modularCalculatorProject');
            if (saved) {
                const project = JSON.parse(saved);
                
                // 清空当前工作区
                this.modules.forEach(module => {
                    const element = document.getElementById(module.id);
                    if (element) element.remove();
                });
                
                this.modules = [];
                this.connections = project.connections || [];
                
                // 创建模块
                project.modules.forEach(moduleConfig => {
                    const module = this.addModule(moduleConfig.type, moduleConfig.x, moduleConfig.y);
                    if (module) {
                        module.name = moduleConfig.name;
                        module.inputValues = moduleConfig.inputValues || [];
                        module.outputValues = moduleConfig.outputValues || [];
                        
                        // 更新UI
                        const title = document.querySelector(`#${module.id} .module-title span`);
                        if (title) {
                            title.textContent = module.name;
                        }
                        
                        // 设置输入值
                        moduleConfig.inputValues.forEach((value, index) => {
                            const inputField = document.querySelector(
                                `input[data-module="${module.id}"][data-input="${index}"]`
                            );
                            if (inputField) {
                                inputField.value = value;
                            }
                        });
                        
                        this.calculateModule(module.id);
                    }
                });
                
                this.updateConnections();
                this.showNotification('已加载保存的项目', 'info');
            }
        } catch (error) {
            console.error('加载项目失败:', error);
            localStorage.removeItem('modularCalculatorProject');
        }
    }
    
    // 更新连接
    updateConnections() {
        // 清除现有连接线
        document.querySelectorAll('.connection').forEach(el => el.remove());
        
        // 简化：这里不实现可视化连线
        // 实际应用中可以绘制连接线
        
        // 更新连接计数
        this.updateUI();
    }
    
    // 更新UI
    updateUI() {
        // 更新模块计数
        document.getElementById('moduleCount').textContent = `${this.modules.length} 个模块`;
        document.getElementById('connectionCount').textContent = `${this.connections.length} 个连接`;
        document.getElementById('infoModuleCount').textContent = this.modules.length;
    }
    
    // 更新最后计算时间
    updateLastCalcTime() {
        const element = document.getElementById('lastCalcTime');
        if (element && this.lastCalculationTime) {
            const timeStr = this.lastCalculationTime.toLocaleTimeString();
            element.textContent = timeStr;
        }
    }
    
    // 切换主题
    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        document.documentElement.setAttribute('data-theme', this.isDarkTheme ? 'dark' : 'light');
        
        const icon = document.querySelector('#themeToggle i');
        icon.className = this.isDarkTheme ? 'fas fa-sun' : 'fas fa-moon';
        
        localStorage.setItem('calculatorTheme', this.isDarkTheme ? 'dark' : 'light');
        this.showNotification(`已切换到${this.isDarkTheme ? '深色' : '浅色'}主题`, 'info');
    }
    
    // 过滤模块
    filterModules(query) {
        const categories = document.querySelectorAll('.category');
        const searchTerm = query.toLowerCase();
        
        categories.forEach(category => {
            const modules = category.querySelectorAll('.module-card');
            let visibleCount = 0;
            
            modules.forEach(module => {
                const name = module.querySelector('h4').textContent.toLowerCase();
                const desc = module.querySelector('p').textContent.toLowerCase();
                
                if (name.includes(searchTerm) || desc.includes(searchTerm)) {
                    module.style.display = 'flex';
                    visibleCount++;
                } else {
                    module.style.display = 'none';
                }
            });
            
            // 隐藏空类别
            category.style.display = visibleCount > 0 ? 'block' : 'none';
        });
    }
    
    // 显示帮助
    showHelp() {
        document.getElementById('helpModal').classList.add('active');
    }
    
    // 关闭模态框
    closeModal() {
        document.getElementById('helpModal').classList.remove('active');
    }
    
    // 显示通知
    showNotification(message, type = 'info') {
        const notificationArea = document.getElementById('notificationArea');
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        notificationArea.appendChild(notification);
        
        // 显示通知
        setTimeout(() => notification.classList.add('show'), 10);
        
        // 3秒后移除
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // 添加历史记录
    addHistory(action, data = {}) {
        this.history.push({
            action,
            data,
            timestamp: new Date()
        });
        
        // 限制历史记录数量
        if (this.history.length > 100) {
            this.history.shift();
        }
    }
    
    // 撤销
    undo() {
        if (this.history.length > 0) {
            const lastAction = this.history.pop();
            this.showNotification(`已撤销: ${lastAction.action}`, 'info');
        }
    }
    
    // 重做
    redo() {
        // 简化实现
        this.showNotification('重做功能开发中', 'info');
    }
    
    // 模拟CPU使用率
    simulateCPUUsage() {
        setInterval(() => {
            const usage = Math.floor(Math.random() * 30) + 5;
            document.getElementById('cpuUsage').textContent = `${usage}%`;
        }, 3000);
    }
    
    // 显示欢迎消息
    showWelcomeMessage() {
        setTimeout(() => {
            if (this.modules.length === 0) {
                this.showNotification('欢迎使用模块化计算器！从左侧拖拽模块开始构建计算流程。', 'info');
            }
        }, 1500);
    }
}

// 初始化应用
window.addEventListener('DOMContentLoaded', () => {
    // 加载保存的主题
    const savedTheme = localStorage.getItem('calculatorTheme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // 创建应用实例
    window.calculatorApp = new ModularCalculator();
});