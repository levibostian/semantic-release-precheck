export interface PluginConfig {
  precheck_command: string
  deploy_plugin: {
    name: string
    config?: Object
  }  
}