export interface PluginConfig {
  is_it_deployed?: {
    package_name: string
    package_manager: string 
  }
  should_skip_deployment_cmd?: string
  check_if_deployed_after_publish?: boolean
  deploy_plugin: {
    name: string
    config?: Object
  }  
}

// returns a string (error message) if invalid. 
export function isValid(config: PluginConfig): string | undefined {
  if (!config.is_it_deployed && !config.should_skip_deployment_cmd) return 'Either is_it_deployed or should_skip_deployment_cmd must be defined in configuration for this plugin. See docs for how to implement.'

  if (config.is_it_deployed) {
    if (!config.is_it_deployed.package_manager) return 'is_it_deployed.package_manager must be defined in configuration for this plugin. See docs for how to implement.'
    if (!config.is_it_deployed.package_name) return 'is_it_deployed.package_name must be defined in configuration for this plugin. See docs for how to implement.'
  }

  if (!config.deploy_plugin) return 'deploy_plugin must be defined in configuration for this plugin. See docs for how to implement.'
  if (!config.deploy_plugin.name) return 'deploy_plugin.name must be defined in configuration for this plugin. See docs for how to implement.'

  return undefined
}