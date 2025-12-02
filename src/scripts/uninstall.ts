import { readFileSync, writeFileSync } from 'fs'

function cleanupScripts() {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    const deployScripts = Object.keys(pkg.scripts || {}).filter(script => script.startsWith('deploy'))

    if (deployScripts.length === 0) {
      console.log('ℹ️ 没有找到部署相关脚本')
      return
    }

    deployScripts.forEach(script => {
      delete pkg.scripts[script]
      console.log(`✅ 已删除脚本: ${script}`)
    })

    writeFileSync('package.json', JSON.stringify(pkg, null, 2))
    console.log('✅ 部署脚本清理完成')
  } catch (error: any) {
    console.error('❌ 清理失败:', error.message)
  }
}

cleanupScripts()
