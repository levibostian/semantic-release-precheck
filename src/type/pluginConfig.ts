export interface PluginConfig {
  is_it_deployed?: {
    package_name: string
    package_manager: string 
  }
  should_skip_cmd?: string
  check_after_publish: boolean
  deploy_plugin: {
    name: string
    config: Object
  }  
}

// returns a string (error message) if invalid. 
export function parse(config: any): PluginConfig | Error {
  let returnResult: any = {}

  if (config.is_it_deployed) {    
    if (!config.is_it_deployed.package_manager) return Error('is_it_deployed.package_manager must be defined in configuration for this plugin. See docs for how to implement.')
    if (!config.is_it_deployed.package_name) return Error('is_it_deployed.package_name must be defined in configuration for this plugin. See docs for how to implement.')

    returnResult.is_it_deployed = {
      package_name: config.is_it_deployed.package_name,
      package_manager: config.is_it_deployed.package_manager
    }
  }

  if (!config.deploy_plugin) return Error('deploy_plugin must be defined. See docs for how to implement.')

  if (typeof config.deploy_plugin !== 'string' && !Array.isArray(config.deploy_plugin)) return Error('deploy_plugin is not configured correctly. See docs for how to implement.')
  if (Array.isArray(config.deploy_plugin)) {
    if (config.deploy_plugin.length < 2) return Error('deploy_plugin is not configured correctly. See docs for how to implement.')
    if (typeof config.deploy_plugin[0] !== 'string' && typeof config.deploy_plugin[1] !== 'object') return Error('deploy_plugin is not configured correctly. See docs for how to implement.')

    returnResult.deploy_plugin = {
      name: config.deploy_plugin[0],
      config: config.deploy_plugin[1]
    }
  } else {
    returnResult.deploy_plugin = {
      name: config.deploy_plugin,
      config: {}
    }
  }

  if (config.should_skip_cmd) {
    if (typeof config.should_skip_cmd !== 'string') return Error('should_skip_cmd must be a string. See docs for how to implement.')
    returnResult.should_skip_cmd = config.should_skip_cmd
  }

  if (config.check_after_publish !== undefined) {
    if (typeof config.check_after_publish !== 'boolean') return Error('check_after_publish must be a boolean. See docs for how to implement.')
    returnResult.check_after_publish = config.check_after_publish
  } else {
    returnResult.check_after_publish = true 
  }

  return returnResult
}