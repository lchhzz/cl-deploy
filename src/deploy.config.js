/**
 * 部署配置
 */
const config = [
  {
    // 环境名称
    name: 'development',
    // 服务器配置
    server: {
      host: '114.132.223.133',
      // 默认22
      port: 22,
      // 登陆信息 环境变量 格式为 userName\password
      sshInfo: process.env.SSH_INFO || '',
      // 可选：使用密钥认证 有密钥不使用 sshInfo
      sshKey: ''
    },

    // 路径配置
    paths: {
      // 本地路径
      localDist: './dist',
      // 上传路径
      remotePath: '/usr/local/nginx/html/dev',
      // 上传文件夹
      projectName: 'mch-b',
      // 红绿模式切换文件夹 默认：old_{projectName}
      oldName: 'old_{projectName}'
    },

    // 部署选项
    options: {
      // 是否启用备份
      backup: true,
      // 是否跳过备份（红绿模式）
      noBackup: false
    }
  }
]

export default config
