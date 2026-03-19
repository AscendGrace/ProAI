<div align="center">

<h1> 🛡️ ProAI 大模型安全评估平台 </h1>

<p>
一款专业的 AI 大模型安全评估与测试平台，支持多种安全标准和自动化测试流程。
<p>
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-5.2-green.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/license-AGPL--3.0-yellow)](https://github.com/AscendGrace/ProAI/blob/main/LICENSE)
</div>

## 目录

- [功能特色](#功能特色)
- [功能截图](#功能截图)
- [快速开始](#快速开始)
- [目录结构](#目录结构)
- [技术栈](#技术栈)
- [核心模块说明](#核心模块说明)
- [贡献指南](#贡献指南)
- [开源协议](#开源协议)
- [特别鸣谢](#特别鸣谢)
- [关于我们][#关于我们]

##  功能特色

###  AI 模型安全评估
- **多标准支持**：内置 TC260 国标测试集、通用测试集
- **自定义测试**：支持自定义提示词库和测试场景
- **自动化评估**：基于 AI 评估器自动判定模型输出安全性
- **详细报告**：生成完整的评估报告，支持导出 HTML 格式

###  MCP 安全评估
- **代码审计**：自动分析 MCP 服务器代码结构和潜在风险
- **漏洞检测**：识别常见安全漏洞（命令注入、路径遍历等）
- **AI 辅助审计**：利用大模型深度分析代码安全性
- **可利用性评估**：评估发现漏洞的实际威胁等级

###  数据管理
- **弹药库管理**：统一管理测试提示词，支持批量导入/导出
- **评估历史**：完整记录所有评估任务和结果
- **数据可视化**：直观展示评估趋势和统计数据

##  功能截图

### 仪表盘
![Dashboard](img/dashboard.png)
*实时查看评估统计、趋势分析和快速操作入口*

### 模型评估
![Evaluation Center](img/evaluation-center.png)
*创建和配置 AI 模型安全评估任务*

### MCP 评估

![MCP Scan](img/mcp-scan.png)
*上传并扫描 MCP 服务器代码包，自动生成安全审计报告*

### 评估报告
![Evaluation Report](img/evaluation-report.png)
*详细的评估结果展示，包含每条测试的输入输出和判定结果*

### 弹药库管理
![Arsenal](img/arsenal.png)
*管理测试提示词库，支持多种标准和自定义内容*

##  快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式

同时启动前端和后端开发服务器：

```bash
npm run dev
```

或分别启动：

```bash
# 启动前端（端口 5173）
npm run dev:web

# 启动后端 API（端口 3000）
npm run dev:api
```

### 生产构建

```bash
# 构建前端和后端
npm run build

# 启动生产环境 API 服务
npm run start:api
```

### 配置评估器

首次使用需要配置 AI 评估器：

1. 访问  `模型设置`
2. 选择提供商（OpenAI 或 Ollama）
3. 填写 API 地址和密钥
4. 测试连接并保存

##  目录结构

```
proai/
├─ public/                 # 静态资源
├─ server/                 # Express API 与评估任务执行逻辑
├─ src/
│  ├─ components/          # 公共组件
│  ├─ layout/              # 页面布局
│  ├─ pages/               # 业务页面
│  ├─ api.ts               # 前端 API 封装
│  ├─ types.ts             # 类型定义
│  └─ App.tsx              # 路由入口
├─ package.json
└─ README.md
```

##  技术栈

### 前端
- **框架**：React 19 + TypeScript
- **路由**：React Router 7
- **构建工具**：Vite 7
- **图表**：Recharts
- **引导提示**：Driver.js

### 后端
- **运行时**：Node.js + TypeScript
- **框架**：Express 5
- **数据库**：SQLite 3
- **文件上传**：Multer
- **数据验证**：Zod

##  核心模块说明

### 评估引擎
评估引擎负责执行 AI 模型安全测试：
1. 从弹药库选择测试提示词
2. 发送到被测模型获取输出
3. 将输出提交给评估器模型判定
4. 记录结果并生成报告

### MCP 扫描器
MCP 扫描器采用多阶段流水线架构：
1. **项目分析**：解析代码结构，识别工具和资源
2. **AI 审计**：利用大模型分析潜在安全风险
3. **可利用性评估**：评估漏洞的实际威胁等级
4. **报告生成**：汇总发现并生成详细报告

### 数据持久化
使用 SQLite 存储所有数据：
- `evaluations` - 评估任务
- `evaluation_items` - 评估明细
- `prompts` - 提示词库
- `mcp_scans` - MCP 扫描任务
- `settings` - 系统配置

##  贡献指南

欢迎提交 Issue 和 Pull Request！

##  开源协议

[AGPL-3.0 License](LICENSE) © 2026 ProAI Contributors

## 特别鸣谢
本项目通用测试集使用 Rogue Security 提供的数据集：
https://huggingface.co/datasets/rogue-security/prompt-injections-benchmark

## 关于我们

华清未央科技有限公司成立于2023年12月。是全球首家机器语言大模型供应商。公司秉持着做网络空间智能体的愿景，专注突破人工智能技术赋能网络空间，致力于提供软件功能开发、性能优化、安全分析的标准化、智能化解决方案。公司和团队在软件人工分析、自动分析、智能分析方面深耕十余年，研究成果处于世界领先水平。

[![Logo](img/logo.png)](https://huaqing.org.cn)