import { EnvironmentConfig } from './types/config'

/**
 * 部署配置
 */
const config: Array<EnvironmentConfig> = [
  {
    // 环境名称
    name: 'development',
    // 服务器配置
    server: {
      host: '',
      // 默认22
      port: 22,
      // 登陆信息
      userName: '',
      password: '',
      // 可选：使用密钥认证 有密钥不使用 密码
      sshKey: ''
    },

    // 路径配置
    paths: {
      // 本地路径
      localDist: './dist',
      // 上传路径
      remotePath: '/usr/local',
      // 上传文件夹
      projectName: ''
    },

    // 部署选项
    options: {
      // 部署前要执行的命令
      preDeploy: [],
      // 部署后要执行的命令
      postDeploy: [],
      // 是否启用备份
      backup: false,
      // 是否开启红绿模式(创建 new_{项目名称} 交换)
      dichromatic: true
    }
  }
]

export default config
