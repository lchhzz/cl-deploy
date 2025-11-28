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
      // 登陆信息
      userName: 'luochuan',
      password: '1234#EDCxsw2!QAZ',
      // 可选：使用密钥认证 有密钥不使用 密码
      sshKey: ''
    },

    // 路径配置
    paths: {
      // 本地路径
      localDist: './dist',
      // 上传路径
      remotePath: '/usr/local/nginx/html/deploy',
      // 上传文件夹
      projectName: 'cl-deploy'
    },

    // 部署选项
    options: {
      preDeploy: [],
      postDeploy: [],
      // 是否启用备份
      backup: true,
      // 是否开启红绿模式(创建 new_{项目名称} 交换)
      dichromatic: true
    }
  }
]

export default config
