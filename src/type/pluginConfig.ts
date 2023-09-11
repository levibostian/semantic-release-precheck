export interface PluginConfig {
  shoud_skip_deployment_cmd: string
  deploy_plugin: {
    name: string
    config?: Object
  }  
}