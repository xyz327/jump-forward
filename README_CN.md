# Jump Forward 🚀

[English](./README.md) | 简体中文

[![Wails v3](https://img.shields.io/badge/Wails-v3-blue?style=flat-square)](https://wails.io)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat-square&logo=go)](https://golang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org)

Jump Forward 是一款基于 **Go** 和 **Wails v3** 开发的现代化、跨平台 SSH 端口转发管理工具。它通过简洁直观的界面，简化了复杂的 SSH 隧道和跳板机（Bastion Host）连接管理。

![界面截图](docs/img/main1.png)

## ✨ 功能特性

- **🛡️ 安全隧道管理**：轻松管理多个 SSH 端口转发规则。
- **🏗️ 跳板机支持**：内置跳板机支持，支持 **密码** 和 **SSH 密钥** 身份验证。
- **🔄 智能更新**：基于 GitHub Releases 的版本检查与在线更新提醒。
- **📊 实时状态监控**：
  - 实时显示连接状态（运行中、已停止、错误）。
  - **活动连接追踪**：直接在卡片上显示客户端 IP 和连接时间。
  - 交互式终端风格的日志查看器，实时掌握流量动态。
- **🌐 国际化支持 (i18n)**：
  - 完整支持 **中文（默认）** 和 **英文**。
  - 无需重启，一键即时切换语言。
- **🔍 智能过滤与搜索**：
  - 支持按规则名称或远程地址快速搜索。
  - **跳板机多选过滤**：可按服务器维度高效组织和筛选规则。
- **📦 配置导入导出**：
  - 支持带密码加密的配置文件 **导出与导入**，确保数据迁移安全。
  - 所有设置自动持久化保存。
- **🍎 macOS 深度优化**：
  - 原生 **单实例运行限制**。
  - 自动化 **DMG 安装包** 生成，配有专业的蓝色盾牌图标。
- **🔔 通知系统**：实时的 Toast 弹窗通知，涵盖连接成功、断开及系统告警。

## 🚀 快速上手

### 环境要求

- [Go](https://golang.org/dl/) 1.21+
- [Node.js](https://nodejs.org/) 18+
- [Wails v3 CLI](https://v3.wails.io/getting-started/installation/)

### 安装与构建

1. **安装 Wails v3 CLI**:
   ```bash
   go install github.com/wailsapp/wails/v3/cmd/wails3@latest
   ```

2. **克隆项目并安装依赖**:
   ```bash
   git clone https://github.com/your-repo/jump-forward.git
   cd jump-forward/frontend
   npm install
   ```

3. **开发模式运行**:
   ```bash
   # 在项目根目录下运行
   wails3 dev
   ```

4. **生产环境打包 (macOS DMG)**:
   ```bash
   wails3 task package:dmg
   ```
   打包结果将生成在 `bin/jump-forward.dmg`。

## 🛠️ 技术栈

- **后端**: [Go](https://golang.org/), [Wails v3](https://wails.io/)
- **前端**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/)
- **图标**: [Lucide React](https://lucide.dev/)
- **状态管理与插件**: [i18next](https://www.i18next.com/), [Sonner](https://sonner.emilkowal.ski/)

## 📄 开源协议

本项目采用 MIT 协议开源 - 详情请参阅 [LICENSE](LICENSE) 文件。
