// dist/scripts/setup.js
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function addDeployScripts() {
  try {
    const packageJsonPath = resolve(process.cwd(), 'package.json')

    if (!existsSync(packageJsonPath)) {
      console.log('📦 未找到 package.json，跳过脚本添加')
      return
    }

    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

    // 定义要添加的脚本
    const deployScripts = {
      deploy: 'view-deploy deploy',
      'deploy:init': 'view-deploy init',
      'deploy:test': 'view-deploy test',
      'deploy:config': 'view-deploy config'
    }

    // 初始化 scripts 对象（如果不存在）
    pkg.scripts = pkg.scripts || {}

    let addedCount = 0

    // 只添加不存在的脚本
    for (const [name, command] of Object.entries(deployScripts)) {
      if (!pkg.scripts[name]) {
        pkg.scripts[name] = command
        addedCount++
        console.log(`✅ 已添加脚本: ${name}`)
      }
    }

    if (addedCount > 0) {
      // 写回 package.json
      writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2))
      console.log(`🎉 成功添加 ${addedCount} 个部署脚本到 package.json`)
    } else {
      console.log('📝 部署脚本已存在，无需添加')
    }
  } catch (error: any) {
    console.error('❌ 添加部署脚本失败:', error.message)
  }
}

addDeployScripts()
