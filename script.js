// ===== 1. 新增：连线管理器类 =====
class ConnectionManager {
    constructor(workspaceElement) {
        this.connections = [];
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.id = 'connectionCanvas';
        this.workspace = workspaceElement;
        this.draggingConnection = null;
        this.tempLine = null;
        
        this.setupCanvas();
        this.bindEvents();
    }
    
    setupCanvas() {
        Object.assign(this.canvas.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            pointerEvents: 'none',
            zIndex: '5'
        });
        this.workspace.appendChild(this.canvas);
        this.resizeCanvas();
    }
    
    bindEvents() {
        window.addEventListener('resize', () => this.resizeCanvas());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.draggingConnection) {
                this.cleanupDrag();
            }
        });
    }
    
    resizeCanvas() {
        const rect = this.workspace.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.drawAll();
    }
    
    getPortPosition(moduleId, portType, portIndex) {
        const moduleEl = document.getElementById(moduleId);
        if (!moduleEl) return null;
        
        const workspaceRect = this.workspace.getBoundingClientRect();
        const portSelector = `.port.${portType}[data-index="${portIndex}"]`;
        const portEl = moduleEl.querySelector(portSelector);
        
        if (!portEl) return null;
        
        const portRect = portEl.getBoundingClientRect();
        return {
            x: portRect.left - workspaceRect.left + portRect.width / 2,
            y: portRect.top - workspaceRect.top + portRect.height / 2
        };
    }
    
    drawConnection(conn) {
        const start = this.getPortPosition(conn.sourceModule, 'output', conn.sourcePort);
        const end = this.getPortPosition(conn.targetModule, 'input', conn.targetPort);
        
        if (!start || !end) return;
        
        // 绘制贝塞尔曲线
        this.ctx.beginPath();
        const cp1 = { x: start.x + 60, y: start.y };
        const cp2 = { x: end.x - 60, y: end.y };
        this.ctx.moveTo(start.x, start.y);
        this.ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        
        this.ctx.strokeStyle = '#3498db';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // 绘制箭头
        const angle = Math.atan2(end.y - cp2.y, end.x - cp2.x);
        this.ctx.beginPath();
        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(
            end.x - 10 * Math.cos(angle - Math.PI / 6),
            end.y - 10 * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
            end.x - 10 * Math.cos(angle + Math.PI / 6),
            end.y - 10 * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fillStyle = '#3498db';
        this.ctx.fill();
    }
    
    drawTempLine(fromX, fromY, toX, toY) {
        this.drawAll(); // 重绘所有固定连线
        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(toX, toY);
        this.ctx.strokeStyle = '#3498db';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 3]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
    
    drawAll() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.connections.forEach(conn => this.drawConnection(conn));
    }
    
    addConnection(sourceModule, sourcePort, targetModule, targetPort) {
        // 检查是否已存在相同连接
        const exists = this.connections.some(conn => 
            conn.sourceModule === sourceModule && 
            conn.sourcePort === sourcePort &&
            conn.targetModule === targetModule && 
            conn.targetPort === targetPort
        );
        
        if (!exists) {
            const newConn = { sourceModule, sourcePort, targetModule, targetPort };
            this.connections.push(newConn);
            this.drawAll();
            
            // 更新端口连接状态
            this.updatePortConnectionState(sourceModule, 'output', sourcePort, true);
            this.updatePortConnectionState(targetModule, 'input', targetPort, true);
            
            return newConn;
        }
        return null;
    }
    
    removeConnection(sourceModule, sourcePort, targetModule, targetPort) {
        const index = this.connections.findIndex(conn => 
            conn.sourceModule === sourceModule && 
            conn.sourcePort === sourcePort &&
            conn.targetModule === targetModule && 
            conn.targetPort === targetPort
        );
        
        if (index > -1) {
            this.connections.splice(index, 1);
            this.drawAll();
            
            // 更新端口连接状态
            this.updatePortConnectionState(sourceModule, 'output', sourcePort, false);
            this.updatePortConnectionState(targetModule, 'input', targetPort, false);
        }
    }
    
    removeConnectionsTo(moduleId) {
        this.connections = this.connections.filter(conn => {
            if (conn.sourceModule === moduleId || conn.targetModule === moduleId) {
                // 更新断开连接的端口状态
                if (conn.sourceModule === moduleId) {
                    this.updatePortConnectionState(conn.sourceModule, 'output', conn.sourcePort, false);
                }
                if (conn.targetModule === moduleId) {
                    this.updatePortConnectionState(conn.targetModule, 'input', conn.targetPort, false);
                }
                return false;
            }
            return true;
        });
        this.drawAll();
    }
    
    updatePortConnectionState(moduleId, portType, portIndex, connected) {
        const moduleEl = document.getElementById(moduleId);
        if (!moduleEl) return;
        
        const portEl = moduleEl.querySelector(`.port.${portType}[data-index="${portIndex}"]`);
        if (portEl) {
            if (connected) {
                portEl.classList.add('connected');
            } else {
                portEl.classList.remove('connected');
            }
        }
    }
    
    startDrag(sourceModule, sourcePort, clientX, clientY) {
        const workspaceRect = this.workspace.getBoundingClientRect();
        const startPos = this.getPortPosition(sourceModule, 'output', sourcePort);
        
        if (!startPos) return;
        
        this.draggingConnection = {
            sourceModule,
            sourcePort,
            startPos
        };
        
        this.tempLine = {
            fromX: startPos.x,
            fromY: startPos.y,
            toX: clientX - workspaceRect.left,
            toY: clientY - workspaceRect.top
        };
        
        this.drawTempLine(this.tempLine.fromX, this.tempLine.fromY, this.tempLine.toX, this.tempLine.toY);
    }
    
    updateDrag(clientX, clientY) {
        if (!this.draggingConnection || !this.tempLine) return;
        
        const workspaceRect = this.workspace.getBoundingClientRect();
        this.tempLine.toX = clientX - workspaceRect.left;
        this.tempLine.toY = clientY - workspaceRect.top;
        
        this.drawTempLine(this.tempLine.fromX, this.tempLine.fromY, this.tempLine.toX, this.tempLine.toY);
    }
    
    finishDrag(targetModule, targetPort) {
        if (!this.draggingConnection) return null;
        
        const { sourceModule, sourcePort } = this.draggingConnection;
        const newConnection = this.addConnection(sourceModule, sourcePort, targetModule, targetPort);
        
        this.cleanupDrag();
        return newConnection;
    }
    
    cleanupDrag() {
        this.draggingConnection = null;
        this.tempLine = null;
        this.drawAll();
    }
    
    getConnectionsForModule(moduleId) {
        return this.connections.filter(conn => 
            conn.sourceModule === moduleId || conn.targetModule === moduleId
        );
    }
    
    getInputConnections(moduleId, inputIndex) {
        return this.connections.filter(conn => 
            conn.targetModule === moduleId && conn.targetPort === inputIndex
        );
    }
}

// ===== 2. 模块化计算器 - 主应用程序 =====
class ModularCalculator {
    constructor() {
        this.modules = [];
        this.selectedModuleId = null;
        this.moduleCounter = 0;
        this.lastCalculationTime = null;
        this.isDarkTheme = false;
        this.history = [];
        
        // 初始化连线管理器
        this.connectionManager = new ConnectionManager(document.getElementById('workspaceArea'));
        
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
        });
        
        workspace.addEventListener('drop', (e) => {
            e.preventDefault();
            const moduleType = e.dataTransfer.getData('moduleType');
            if (moduleType) {
                const rect = workspace.getBoundingClientRect();
                const x = e.clientX - rect.left - 80;
                const y = e.clientY - rect.top - 60;
                this.addModule(moduleType, x, y);
            }
        });
        
        // 连线拖拽事件
        document.addEventListener('mousemove', (e) => {
            if (this.connectionManager.draggingConnection) {
                this.connectionManager.updateDrag(e.clientX, e.clientY);
            }
        });
        
        document.addEventListener('mouseup', (e) => {
            if (this.connectionManager.draggingConnection && e.target.classList.contains('port')) {
                const port = e.target;
                const moduleId = port.closest('.calc-module').id;
                const portType = port.classList.contains('input') ? 'input' : 'output';
                const portIndex = parseInt(port.getAttribute('data-index'));
                
                if (portType === 'input') {
                    this.connectionManager.finishDrag(moduleId, portIndex);
                    // 触发目标模块重新计算
                    this.calculateModule(moduleId);
                }
            } else if (this.connectionManager.draggingConnection) {
                this.connectionManager.cleanupDrag();
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
            
            // Escape 取消选择/取消连线
            if (e.key === 'Escape') {
                this.selectModule(null);
                if (this.connectionManager.draggingConnection) {
                    this.connectionManager.cleanupDrag();
                }
            }
        });
        
        // 窗口大小变化
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.connectionManager.resizeCanvas();
            }, 100);
        });
        
        // 工作区缩放事件
        workspace.addEventListener('mouseenter', () => {
            this.connectionManager.resizeCanvas();
        });
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
                <div class="module-ports">
                    <div class="port-container">
                        <!-- 无输入端口 -->
                    </div>
                    <div class="port-container">
                        <div class="port output" data-index="0" title="输出"></div>
                    </div>
                </div>
                <div class="module-body">
                    <div class="input-group">
                        <label>数值</label>
                        <input type="number" class="input-field" value="0" 
                               data-module="${id}" data-output="0" step="any">
                    </div>
                </div>
            `,
            calculate: (module) => {
                const input = document.querySelector(`input[data-module="${module.id}"][data-output="0"]`);
                const value = parseFloat(input.value) || 0;
                return value.toFixed(3); // 优化：三位小数精度
            }
        },
        
        'slider-input': {
            name: '滑块输入',
            color: '#9b59b6',
            icon: '<i class="fas fa-sliders-h"></i>',
            inputs: 0,
            outputs: 1,
            createBody: (id) => `
                <div class="module-ports">
                    <div class="port-container">
                        <!-- 无输入端口 -->
                    </div>
                    <div class="port-container">
                        <div class="port output" data-index="0" title="输出"></div>
                    </div>
                </div>
                <div class="module-body">
                    <div class="output-group">
                        <label>值: <span id="sliderValue-${id}">50</span></label>
                        <input type="range" class="input-field" min="0" max="100" value="50" 
                               data-module="${id}" data-output="0" id="slider-${id}">
                    </div>
                </div>
            `,
            calculate: (module) => {
                const slider = document.getElementById(`slider-${module.id}`);
                const value = parseFloat(slider.value) || 0;
                return value.toFixed(3); // 优化：三位小数精度
            }
        },
        
        'toggle-input': {
            name: '开关输入',
            color: '#2ecc71',
            icon: '<i class="fas fa-toggle-on"></i>',
            inputs: 0,
            outputs: 1,
            createBody: (id) => `
                <div class="module-ports">
                    <div class="port-container">
                        <!-- 无输入端口 -->
                    </div>
                    <div class="port-container">
                        <div class="port output" data-index="0" title="输出"></div>
                    </div>
                </div>
                <div class="module-body">
                    <div class="output-group">
                        <label>状态</label>
                        <div class="toggle-switch">
                            <input type="checkbox" id="toggle-${id}" data-module="${id}" data-output="0" checked>
                            <label for="toggle-${id}" class="toggle-label"></label>
                        </div>
                    </div>
                </div>
            `,
            calculate: (module) => {
                const toggle = document.getElementById(`toggle-${module.id}`);
                return toggle.checked ? '1.000' : '0.000'; // 优化：三位小数精度
            }
        },
        
        'addition': {
            name: '加法器',
            color: '#2ecc71',
            icon: '<i class="fas fa-plus"></i>',
            inputs: 2,
            outputs: 1,
            createBody: (id) => `
                <div class="module-ports">
                    <div class="port-container">
                        <div class="port input" data-index="0" title="输入 A"></div>
                        <div class="port input" data-index="1" title="输入 B"></div>
                    </div>
                    <div class="port-container">
                        <div class="port output" data-index="0" title="输出"></div>
                    </div>
                </div>
                <div class="module-body calculation-only">
                    <div class="input-group">
                        <label>A:</label>
                        <input type="number" class="input-field" data-input="0" step="any" placeholder="或连线输入">
                    </div>
                    <div class="input-group">
                        <label>B:</label>
                        <input type="number" class="input-field" data-input="1" step="any" placeholder="或连线输入">
                    </div>
                </div>
            `,
            calculate: (module) => {
                const inputA = this.getInputValue(module, 0);
                const inputB = this.getInputValue(module, 1);
                const result = inputA + inputB;
                return result.toFixed(3); // 优化：三位小数精度
            }
        },
        
        'subtraction': {
            name: '减法器',
            color: '#e74c3c',
            icon: '<i class="fas fa-minus"></i>',
            inputs: 2,
            outputs: 1,
            createBody: (id) => `
                <div class="module-ports">
                    <div class="port-container">
                        <div class="port input" data-index="0" title="输入 A"></div>
                        <div class="port input" data-index="1" title="输入 B"></div>
                    </div>
                    <div class="port-container">
                        <div class="port output" data-index="0" title="输出"></div>
                    </div>
                </div>
                <div class="module-body calculation-only">
                    <div class="input-group">
                        <label>A:</label>
                        <input type="number" class="input-field" data-input="0" step="any" placeholder="或连线输入">
                    </div>
                    <div class="input-group">
                        <label>B:</label>
                        <input type="number" class="input-field" data-input="1" step="any" placeholder="或连线输入">
                    </div>
                </div>
            `,
            calculate: (module) => {
                const inputA = this.getInputValue(module, 0);
                const inputB = this.getInputValue(module, 1);
                const result = inputA - inputB;
                return result.toFixed(3); // 优化：三位小数精度
            }
        },
        
        'multiplication': {
            name: '乘法器',
            color: '#f39c12',
            icon: '<i class="fas fa-times"></i>',
            inputs: 2,
            outputs: 1,
            createBody: (id) => `
                <div class="module-ports">
                    <div class="port-container">
                        <div class="port input" data-index="0" title="输入 A"></div>
                        <div class="port input" data-index="1" title="输入 B"></div>
                    </div>
                    <div class="port-container">
                        <div class="port output" data-index="0" title="输出"></div>
                    </div>
                </div>
                <div class="module-body calculation-only">
                    <div class="input-group">
                        <label>A:</label>
                        <input type="number" class="input-field" data-input="0" step="any" placeholder="或连线输入">
                    </div>
                    <div class="input-group">
                        <label>B:</label>
                        <input type="number" class="input-field" data-input="1" step="any" placeholder="或连线输入">
                    </div>
                </div>
            `,
            calculate: (module) => {
                const inputA = this.getInputValue(module, 0);
                const inputB = this.getInputValue(module, 1);
                const result = inputA * inputB;
                return result.toFixed(3); // 优化：三位小数精度
            }
        },
        
        'division': {
            name: '除法器',
            color: '#1abc9c',
            icon: '<i class="fas fa-divide"></i>',
            inputs: 2,
            outputs: 1,
            createBody: (id) => `
                <div class="module-ports">
                    <div class="port-container">
                        <div class="port input" data-index="0" title="被除数"></div>
                        <div class="port input" data-index="1" title="除数"></div>
                    </div>
                    <div class="port-container">
                        <div class="port output" data-index="0" title="输出"></div>
                    </div>
                </div>
                <div class="module-body calculation-only">
                    <div class="input-group">
                        <label>被除数:</label>
                        <input type="number" class="input-field" data-input="0" step="any" placeholder="或连线输入">
                    </div>
                    <div class="input-group">
                        <label>除数:</label>
                        <input type="number" class="input-field" data-input="1" step="any" placeholder="或连线输入">
                    </div>
                </div>
            `,
            calculate: (module) => {
                const inputA = this.getInputValue(module, 0);
                const inputB = this.getInputValue(module, 1);
                if (inputB === 0) return "错误: 除零";
                const result = inputA / inputB;
                return result.toFixed(3); // 优化：三位小数精度
            }
        },
        
        'percentage': {
            name: '百分比计算',
            color: '#9b59b6',
            icon: '<i class="fas fa-percentage"></i>',
            inputs: 2,
            outputs: 1,
            createBody: (id) => `
                <div class="module-ports">
                    <div class="port-container">
                        <div class="port input" data-index="0" title="数值"></div>
                        <div class="port input" data-index="1" title="百分比"></div>
                    </div>
                    <div class="port-container">
                        <div class="port output" data-index="0" title="输出"></div>
                    </div>
                </div>
                <div class="module-body calculation-only">
                    <div class="input-group">
                        <label>数值:</label>
                        <input type="number" class="input-field" data-input="0" step="any" placeholder="或连线输入">
                    </div>
                    <div class="input-group">
                        <label>百分比 (%):</label>
                        <input type="number" class="input-field" data-input="1" step="any" placeholder="或连线输入">
                    </div>
                </div>
            `,
            calculate: (module) => {
                const value = this.getInputValue(module, 0);
                const percentage = this.getInputValue(module, 1);
                const result = value * percentage / 100;
                return result.toFixed(3); // 优化：三位小数精度
            }
        },
        
        'average': {
            name: '平均值计算',
            color: '#34495e',
            icon: '<i class="fas fa-chart-bar"></i>',
            inputs: 3,
            outputs: 1,
            createBody: (id) => `
                <div class="module-ports">
                    <div class="port-container">
                        <div class="port input" data-index="0" title="数值 A"></div>
                        <div class="port input" data-index="1" title="数值 B"></div>
                        <div class="port input" data-index="2" title="数值 C"></div>
                    </div>
                    <div class="port-container">
                        <div class="port output" data-index="0" title="输出"></div>
                    </div>
                </div>
                <div class="module-body calculation-only">
                    <div class="input-group">
                        <label>A:</label>
                        <input type="number" class="input-field" data-input="0" step="any" placeholder="或连线输入">
                    </div>
                    <div class="input-group">
                        <label>B:</label>
                        <input type="number" class="input-field" data-input="1" step="any" placeholder="或连线输入">
                    </div>
                    <div class="input-group">
                        <label>C:</label>
                        <input type="number" class="input-field" data-input="2" step="any" placeholder="或连线输入">
                    </div>
                </div>
            `,
            calculate: (module) => {
                const sum = this.getInputValue(module, 0) + 
                           this.getInputValue(module, 1) + 
                           this.getInputValue(module, 2);
                const result = sum / 3;
                return result.toFixed(3); // 优化：三位小数精度
            }
        },
        
        'power': {
            name: '幂运算',
            color: '#e67e22',
            icon: '<i class="fas fa-superscript"></i>',
            inputs: 2,
            outputs: 1,
            createBody: (id) => `
                <div class="module-ports">
                    <div class="port-container">
                        <div class="port input" data-index="0" title="底数"></div>
                        <div class="port input" data-index="1" title="指数"></div>
                    </div>
                    <div class="port-container">
                        <div class="port output" data-index="0" title="输出"></div>
                    </div>
                </div>
                <div class="module-body calculation-only">
                    <div class="input-group">
                        <label>底数 (x):</label>
                        <input type="number" class="input-field" data-input="0" step="any" placeholder="或连线输入">
                    </div>
                    <div class="input-group">
                        <label>指数 (y):</label>
                        <input type="number" class="input-field" data-input="1" step="any" placeholder="或连线输入">
                    </div>
                </div>
            `,
            calculate: (module) => {
                const base = this.getInputValue(module, 0);
                const exponent = this.getInputValue(module, 1);
                const result = Math.pow(base, exponent);
                return result.toFixed(3); // 优化：三位小数精度
            }
        },
        
        'square-root': {
            name: '平方根',
            color: '#2c3e50',
            icon: '<i class="fas fa-square-root-alt"></i>',
            inputs: 1,
            outputs: 1,
            createBody: (id) => `
                <div class="module-ports">
                    <div class="port-container">
                        <div class="port input" data-index="0" title="输入"></div>
                    </div>
                    <div class="port-container">
                        <div class="port output" data-index="0" title="输出"></div>
                    </div>
                </div>
                <div class="module-body calculation-only">
                    <div class="input-group">
                        <label>数值 (x):</label>
                        <input type="number" class="input-field" data-input="0" step="any" placeholder="或连线输入" min="0">
                    </div>
                </div>
            `,
            calculate: (module) => {
                const value = this.getInputValue(module, 0);
                if (value < 0) return "错误: 负数";
                const result = Math.sqrt(value);
                return result.toFixed(3); // 优化：三位小数精度
            }
        },
        
        // 新增：结果显示模块
        'display': {
            name: '结果显示',
            color: '#e74c3c',
            icon: '<i class="fas fa-eye"></i>',
            inputs: 1,
            outputs: 0,
            createBody: (id) => `
                <div class="module-ports">
                    <div class="port-container">
                        <div class="port input" data-index="0" title="输入"></div>
                    </div>
                    <div class="port-container">
                        <!-- 无输出端口 -->
                    </div>
                </div>
                <div class="module-body display-module">
                    <div class="output-group">
                        <div class="output-value" data-module="${id}">0.000</div>
                    </div>
                </div>
            `,
            calculate: (module) => {
                const value = this.getInputValue(module, 0);
                // 优化：三位小数精度，如果是数字则格式化，否则显示原值
                if (typeof value === 'number' && !isNaN(value)) {
                    return value.toFixed(3);
                } else if (typeof value === 'string' && value.includes('错误')) {
                    return value;
                } else {
                    return '0.000';
                }
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
            x = (rect.width - 160) / 2;
            y = (rect.height - 120) / 2;
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
        moduleElement.className = `calc-module ${type === 'display' ? 'display-module' : ''}`;
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
            ${definition.createBody(id)}
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
            if (!e.target.closest('[data-action="delete"]') && !e.target.classList.contains('port')) {
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
                this.updateDependentModules(id);
            });
        });
        
        // 滑块特殊处理
        if (definition.type === 'slider-input') {
            const slider = document.getElementById(`slider-${id}`);
            const sliderValue = document.getElementById(`sliderValue-${id}`);
            
            slider.addEventListener('input', () => {
                sliderValue.textContent = slider.value;
                this.calculateModule(id);
                this.updateDependentModules(id);
            });
        }
        
        // 开关特殊处理
        if (definition.type === 'toggle-input') {
            const toggle = document.getElementById(`toggle-${id}`);
            toggle.addEventListener('change', () => {
                this.calculateModule(id);
                this.updateDependentModules(id);
            });
        }
        
        // 端口连线事件
        const ports = element.querySelectorAll('.port');
        ports.forEach(port => {
            port.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const portType = port.classList.contains('input') ? 'input' : 'output';
                const portIndex = parseInt(port.getAttribute('data-index'));
                
                if (portType === 'output') {
                    this.connectionManager.startDrag(id, portIndex, e.clientX, e.clientY);
                }
            });
            
            port.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                const portType = port.classList.contains('input') ? 'input' : 'output';
                const portIndex = parseInt(port.getAttribute('data-index'));
                
                if (portType === 'input' && this.connectionManager.draggingConnection) {
                    const newConn = this.connectionManager.finishDrag(id, portIndex);
                    if (newConn) {
                        // 连接建立后，触发目标模块重新计算
                        this.calculateModule(id);
                        this.showNotification('连接建立成功', 'success');
                    }
                }
            });
        });
        
        // 使模块可拖动
        this.makeDraggable(element, id);
    }
    
    // 使模块可拖动
    makeDraggable(element, id) {
        const header = element.querySelector('.module-header');
        let isDragging = false;
        let offsetX, offsetY;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('[data-action="delete"]') || e.target.classList.contains('port')) {
                return;
            }
            
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
            
            // 更新连线
            this.connectionManager.drawAll();
        };
        
        const stopDrag = () => {
            isDragging = false;
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
        };
    }
    
    // 获取模块输入值（优化：支持连线输入）
    getInputValue(module, inputIndex) {
        // 1. 优先从连线获取值
        const connections = this.connectionManager.getInputConnections(module.id, inputIndex);
        if (connections.length > 0) {
            const conn = connections[0];
            const sourceModule = this.modules.find(m => m.id === conn.sourceModule);
            if (sourceModule) {
                const outputValue = sourceModule.outputValues[conn.sourcePort];
                if (outputValue !== undefined) {
                    // 如果输出值是字符串（如错误信息），直接返回
                    if (typeof outputValue === 'string') {
                        return outputValue;
                    }
                    return parseFloat(outputValue) || 0;
                }
            }
        }
        
        // 2. 没有连线，则从自身输入框获取
        const inputField = document.querySelector(`#${module.id} input[data-input="${inputIndex}"]`);
        return inputField ? parseFloat(inputField.value) || 0 : 0;
    }
    
    // 计算模块
    calculateModule(moduleId) {
        const module = this.modules.find(m => m.id === moduleId);
        if (!module) return;
        
        const definition = this.moduleDefinitions[module.type];
        if (!definition) return;
        
        try {
            const result = definition.calculate(module);
            
            // 更新模块输出值
            if (definition.outputs > 0) {
                module.outputValues[0] = result;
            }
            
            // 更新UI显示
            const outputElement = document.querySelector(`#${moduleId} .output-value`);
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
        const connections = this.connectionManager.getConnectionsForModule(moduleId);
        connections.forEach(conn => {
            if (conn.sourceModule === moduleId) {
                this.calculateModule(conn.targetModule);
            }
        });
    }
    
    // 执行所有计算
    calculateAll() {
        this.modules.forEach(module => {
            this.calculateModule(module.id);
        });
        
        this.connectionManager.drawAll();
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
                const connections = this.connectionManager.getInputConnections(moduleId, i);
                const connectionInfo = connections.length > 0 ? 
                    `<small style="color: var(--primary-color);">已连接</small>` : '';
                
                propertiesHTML += `
                    <div class="property-item">
                        <label class="property-label">输入 ${String.fromCharCode(65 + i)} ${connectionInfo}</label>
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
                               value="${module.outputValues[i] || '0.000'}" readonly>
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
        if (nameInput) {
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
        }
        
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
                    
                    this.connectionManager.drawAll();
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
                }
            });
        });
        
        // 重新计算按钮
        const recalcBtn = document.getElementById('recalculateBtn');
        if (recalcBtn) {
            recalcBtn.addEventListener('click', () => {
                this.calculateModule(moduleId);
                this.showNotification('模块已重新计算', 'info');
            });
        }
        
        // 复制按钮
        const cloneBtn = document.getElementById('cloneBtn');
        if (cloneBtn) {
            cloneBtn.addEventListener('click', () => {
                this.cloneModule(moduleId);
            });
        }
    }
    
    // 克隆模块
    cloneModule(moduleId) {
        const module = this.modules.find(m => m.id === moduleId);
        if (!module) return;
        
        const newModule = this.addModule(module.type, module.x + 30, module.y + 30);
        if (newModule) {
            newModule.name = `${module.name} (副本)`;
            newModule.inputValues = [...module.inputValues];
            
            // 更新UI中的模块名称
            const title = document.querySelector(`#${newModule.id} .module-title span`);
            if (title) {
                title.textContent = newModule.name;
            }
            
            // 复制输入值
            for (let i = 0; i < module.inputValues.length; i++) {
                const inputField = document.querySelector(
                    `#${newModule.id} input[data-input="${i}"]`
                );
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
            this.connectionManager.removeConnectionsTo(moduleId);
            
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
            this.connectionManager.connections = [];
            this.connectionManager.drawAll();
            this.selectedModuleId = null;
            
            // 显示空工作区
            document.getElementById('emptyWorkspace').classList.remove('hidden');
            this.showEmptyProperties();
            
            // 更新UI
            this.updateUI();
            
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
        const addition = this.addModule('addition', 250, 125);
        const display = this.addModule('display', 450, 125);
        
        // 设置示例数据
        if (input1 && input2 && addition && display) {
            // 设置输入值
            const input1Field = document.querySelector(`#${input1.id} input`);
            const input2Field = document.querySelector(`#${input2.id} input`);
            
            if (input1Field) input1Field.value = 15.5;
            if (input2Field) input2Field.value = 25.3;
            
            // 计算初始值
            this.calculateModule(input1.id);
            this.calculateModule(input2.id);
            this.calculateModule(addition.id);
            
            // 建立连线
            setTimeout(() => {
                this.connectionManager.addConnection(input1.id, 0, addition.id, 0);
                this.connectionManager.addConnection(input2.id, 0, addition.id, 1);
                this.connectionManager.addConnection(addition.id, 0, display.id, 0);
                
                // 重新计算
                this.calculateAll();
                
                this.showNotification('已添加示例计算流程', 'success');
            }, 100);
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
            connections: this.connectionManager.connections,
            version: '1.1',
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
                        const module = this.addModule(
                            moduleConfig.type, 
                            moduleConfig.x, 
                            moduleConfig.y
                        );
                        
                        if (module) {
                            module.name = moduleConfig.name;
                            module.inputValues = moduleConfig.inputValues || [];
                            module.outputValues = moduleConfig.outputValues || [];
                            
                            // 更新UI中的模块名称
                            const title = document.querySelector(`#${module.id} .module-title span`);
                            if (title) {
                                title.textContent = module.name;
                            }
                            
                            // 设置输入值
                            moduleConfig.inputValues.forEach((value, index) => {
                                const inputField = document.querySelector(
                                    `#${module.id} input[data-input="${index}"]`
                                );
                                if (inputField) {
                                    inputField.value = value;
                                }
                            });
                            
                            this.calculateModule(module.id);
                        }
                    });
                    
                    // 恢复连接
                    if (config.connections && Array.isArray(config.connections)) {
                        config.connections.forEach(conn => {
                            this.connectionManager.addConnection(
                                conn.sourceModule, 
                                conn.sourcePort,
                                conn.targetModule, 
                                conn.targetPort
                            );
                        });
                    }
                    
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
            connections: this.connectionManager.connections,
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
                this.connectionManager.connections = [];
                
                // 创建模块
                if (project.modules && Array.isArray(project.modules)) {
                    project.modules.forEach(moduleConfig => {
                        const module = this.addModule(
                            moduleConfig.type, 
                            moduleConfig.x, 
                            moduleConfig.y
                        );
                        
                        if (module) {
                            module.name = moduleConfig.name;
                            module.inputValues = moduleConfig.inputValues || [];
                            module.outputValues = moduleConfig.outputValues || [];
                            
                            // 更新UI中的模块名称
                            const title = document.querySelector(`#${module.id} .module-title span`);
                            if (title) {
                                title.textContent = module.name;
                            }
                            
                            // 设置输入值
                            if (moduleConfig.inputValues) {
                                moduleConfig.inputValues.forEach((value, index) => {
                                    const inputField = document.querySelector(
                                        `#${module.id} input[data-input="${index}"]`
                                    );
                                    if (inputField) {
                                        inputField.value = value;
                                    }
                                });
                            }
                            
                            this.calculateModule(module.id);
                        }
                    });
                }
                
                // 恢复连接
                if (project.connections && Array.isArray(project.connections)) {
                    project.connections.forEach(conn => {
                        this.connectionManager.addConnection(
                            conn.sourceModule, 
                            conn.sourcePort,
                            conn.targetModule, 
                            conn.targetPort
                        );
                    });
                }
                
                this.connectionManager.drawAll();
                this.showNotification('已加载保存的项目', 'info');
            }
        } catch (error) {
            console.error('加载项目失败:', error);
            localStorage.removeItem('modularCalculatorProject');
        }
    }
    
    // 更新UI
    updateUI() {
        // 更新模块计数
        document.getElementById('moduleCount').textContent = `${this.modules.length} 个模块`;
        document.getElementById('connectionCount').textContent = `${this.connectionManager.connections.length} 个连接`;
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
        
        // 重绘连线以适应主题变化
        setTimeout(() => {
            this.connectionManager.drawAll();
        }, 100);
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
