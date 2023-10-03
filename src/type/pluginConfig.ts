import { isItDeployed } from "is-it-deployed"

export interface PluginConfig {
  is_it_deployed?: {
    package_name: string
    package_manager: string 
  }
  should_skip_deployment_cmd?: string
  deploy_plugin: {
    name: string
    config?: Object
  }  
}