# @lchhzz/view-deploy

一个可自定义的 SSH 部署工具，支持前端项目部署，自动转换 Windows/Unix 命令。

## 🌟 主要特性

- 🔄 **自动命令转换** - 在 Windows 和 Unix 系统间无缝转换命令
- 🖥️ **跨平台支持** - 支持 Windows 和 Linux 服务器
- ⚡ **快速部署** - 并行文件上传，带进度指示器
- 🔧 **高度可定制** - 灵活配置，支持多环境
- 🔒 **安全可靠** - 支持密码和 SSH 密钥认证
- 📊 **进度跟踪** - 实时部署进度显示
- 🎯 **TypeScript** - 完整的类型支持，更好的开发体验

## 📦 安装

```bash
# 使用 npm
npm install -g @lchhzz/view-deploy

# 使用 yarn
yarn global add @lchhzz/view-deploy

# 使用 pnpm
pnpm add -g @lchhzz/view-deploy
```

## 🚀 快速开始

### 1. 初始化配置

```bash
# 使用默认配置（TypeScript）
view-deploy init

# 或者指定配置类型和位置
view-deploy init --type ts --path ./deploy
```

### 2. 修改配置文件

编辑生成的 `deploy/deploy.config.ts` 文件，配置服务器信息和部署选项：

```typescript
export default [
  {
    name: 'development',
    server: {
      host: 'your-server.com',
      port: 22,
      userName: 'your-username',
      password: 'your-password'
      // 或使用 SSH 密钥
      // sshKey: '/path/to/your/key.pem'
    },
    paths: {
      localDist: './dist',
      remotePath: '/usr/local',
      projectName: 'your-project'
    },
    options: {
      preDeploy: ['npm run build'],
      postDeploy: ['echo "部署完成"'],
      backup: false,
      dichromatic: true
    }
  }
]
```

### 3. 部署项目

```bash
# 部署到默认环境（development）
view-deploy deploy

# 部署到指定环境
view-deploy deploy --model production
```

## 📋 命令说明

### 初始化配置

```bash
view-deploy init [--type ts|js] [--path <配置文件位置>]
```

- `--type`: 配置文件类型，支持 `ts` 或 `js`，默认 `ts`
- `--path`: 配置文件位置，默认 `./deploy`

### 部署项目

```bash
view-deploy deploy [--model <环境名称>]
```

- `--model`: 环境名称，对应配置文件中的 `name` 字段

### 测试 SSH 连接

```bash
view-deploy test [--model <环境名称>]
```

- `--model`: 环境名称，对应配置文件中的 `name` 字段

### 重置部署

```bash
view-deploy reset [--model <环境名称>]
```

- `--model`: 环境名称，对应配置文件中的 `name` 字段

## 📝 配置文件示例

```typescript
import type { EnvironmentConfig } from '@lchhzz/view-deploy'

const config: EnvironmentConfig[] = [
  {
    name: 'development',
    server: {
      host: 'dev-server.com',
      port: 22,
      userName: 'dev-user',
      password: 'dev-password'
    },
    paths: {
      localDist: './dist',
      remotePath: '/usr/local/dev',
      projectName: 'my-project'
    },
    options: {
      preDeploy: ['npm run build'],
      postDeploy: ['cd /usr/local/dev/my-project && pm2 restart app'],
      backup: false,
      dichromatic: true
    }
  },
  {
    name: 'production',
    server: {
      host: 'prod-server.com',
      port: 22,
      userName: 'prod-user',
      sshKey: '/path/to/prod-key.pem'
    },
    paths: {
      localDist: './dist',
      remotePath: '/usr/local/prod',
      projectName: 'my-project'
    },
    options: {
      preDeploy: ['npm run build:prod'],
      postDeploy: ['cd /usr/local/prod/my-project && pm2 restart app'],
      backup: true,
      dichromatic: false
    }
  }
]

export default config
```

## 🛠️ 配置选项说明

### 环境配置 (EnvironmentConfig)

| 选项      | 类型            | 描述                                    |
| --------- | --------------- | --------------------------------------- |
| `name`    | `string`        | 环境名称（如：development, production） |
| `server`  | `ServerConfig`  | 服务器配置                              |
| `paths`   | `PathConfig`    | 路径配置                                |
| `options` | `DeployOptions` | 部署选项                                |

### 服务器配置 (ServerConfig)

| 选项       | 类型     | 描述                               |
| ---------- | -------- | ---------------------------------- |
| `host`     | `string` | 服务器地址                         |
| `port`     | `number` | SSH 端口，默认 22                  |
| `userName` | `string` | 用户名                             |
| `password` | `string` | 密码（与 sshKey 二选一）           |
| `sshKey`   | `string` | SSH 密钥路径（与 password 二选一） |

### 路径配置 (PathConfig)

| 选项          | 类型     | 描述                               |
| ------------- | -------- | ---------------------------------- |
| `localDist`   | `string` | 本地构建目录路径                   |
| `remotePath`  | `string` | 服务器上的部署根路径               |
| `projectName` | `string` | 项目名称（用于创建服务器上的目录） |

### 部署选项 (DeployOptions)

| 选项          | 类型       | 描述                        |
| ------------- | ---------- | --------------------------- |
| `preDeploy`   | `string[]` | 部署前执行的命令            |
| `postDeploy`  | `string[]` | 部署后执行的命令            |
| `backup`      | `boolean`  | 是否启用备份，默认 false    |
| `dichromatic` | `boolean`  | 是否开启红绿模式，默认 true |

## 🎯 支持的环境

- **操作系统**：Windows, macOS, Linux
- **Node.js**：>= 18.20.4
- **服务器**：支持 SSH 的 Windows 或 Linux 服务器

## 📄 许可证

MIT License © 2023 lchhzz

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 🔗 相关链接

- [GitHub 仓库](https://github.com/lchhzz/view-deploy)
- [NPM 包](https://www.npmjs.com/package/@lchhzz/view-deploy)
