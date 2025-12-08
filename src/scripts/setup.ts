#!/usr/bin/env node
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

console.log('🔧 @lchhzz/view-deploy 安装脚本执行中...')

function getProjectRoot() {
  // 方法1：使用 npm 设置的环境变量（最可靠）
  if (process.env.INIT_CWD) {
    console.log('📁 使用 INIT_CWD:', process.env.INIT_CWD)
    return process.env.INIT_CWD
  }

  // 方法2：检查当前目录是否在 node_modules 中，如果是则向上两级
  const currentDir = process.cwd()
  console.log('📁 当前目录:', currentDir)

  if (currentDir.includes('node_modules')) {
    // 如果在 node_modules/@lchhzz/view-deploy/... 中
    const paths = currentDir.split('node_modules')
    const projectRoot = paths[0] // node_modules 之前的路径
    console.log('📁 检测到 node_modules，项目根目录:', projectRoot)
    return projectRoot
  }

  // 方法3：向上查找包含 package.json 的目录
  let searchDir = currentDir
  for (let i = 0; i < 10; i++) {
    const possiblePkg = resolve(searchDir, 'package.json')
    console.log('🔍 检查路径:', possiblePkg)

    if (existsSync(possiblePkg)) {
      console.log('📁 找到 package.json，项目根目录:', searchDir)
      return searchDir
    }

    const parentDir = resolve(searchDir, '..')
    if (parentDir === searchDir) {
      break // 到达根目录
    }
    searchDir = parentDir
  }

  console.log('⚠️  使用当前目录作为项目根目录')
  return currentDir
}

const projectRoot = getProjectRoot().replace(/\\/g, '/') // 统一路径格式
console.log('🎯 最终项目根目录:', projectRoot)

function addDeployScripts() {
  try {
    const packageJsonPath = resolve(projectRoot, 'package.json')
    console.log('📄 Package.json 路径:', packageJsonPath)

    if (!existsSync(packageJsonPath)) {
      console.log('❌ 未找到 package.json，跳过脚本添加')
      return
    }

    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    console.log('📦 项目名称:', pkg.name || '未设置')

    const deployScripts = {
      deploy: 'view-deploy deploy',
      'deploy:init': 'view-deploy init',
      'deploy:test': 'view-deploy test',
      'deploy:config': 'view-deploy config',
      'deploy:reset': 'view-deploy reset'
    }

    pkg.scripts = pkg.scripts || {}
    let addedCount = 0
    for (const [name, command] of Object.entries(deployScripts)) {
      if (!pkg.scripts[name]) {
        pkg.scripts[name] = command
        addedCount++
        console.log(`✅ 已添加脚本: ${name}`)
      }
    }
    if (addedCount > 0) {
      writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2))
      console.log(`🎉 成功添加 ${addedCount} 个部署脚本到 package.json`)
    } else {
      console.log('📝 部署脚本已存在，无需添加')
    }
    silentAutoInit()
  } catch (error: any) {
    console.error('❌ 添加部署脚本失败:', error.message)
  }
}

function silentAutoInit() {
  try {
    const projectRoot = getProjectRoot()
    const localCliPath = resolve(
      projectRoot,
      'node_modules',
      '@lchhzz',
      'view-deploy',
      'dist',
      'cli.js'
    )

    if (!existsSync(localCliPath)) {
      console.log('🚀 自动运行初始化配置...')
      execSync(`node ${localCliPath} init`)
      console.log('✅ 自动初始化完成！')
    }
  } catch (error) {
    console.log('⚠️  自动初始化失败，请手动运行: npm run deploy:init')
  }
}
addDeployScripts()

console.log(`
💡 使用方法:
npm run deploy:init    # 初始化配置文件
npm run deploy:test    # 测试部署配置
npm run deploy         # 执行部署
npm run reset         # 重置部署
`)
