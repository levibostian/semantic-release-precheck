import { PluginConfig, isValid } from "./pluginConfig"

describe('isValid', () => {
  it('should return error if neither is_it_deployed nor should_skip_deployment_cmd are defined', () => {
    const pluginConfig = {
      deploy_plugin: {
        name: 'test'
      }
    }

    const error = isValid(pluginConfig)

    expect(error).toBeDefined()
  })
  it('should return error if is_it_deployed is defined but nested properties are not', () => {
    const pluginConfigMissingPackageManager = {
      is_it_deployed: {
        package_name: 'test'
      },
      deploy_plugin: {
        name: 'test'
      }
    } as PluginConfig

    expect(isValid(pluginConfigMissingPackageManager)).toBeDefined()
    
    const pluginConfigMissingPackageNam = {
      is_it_deployed: {
        package_manager: 'npm'
      },
      deploy_plugin: {
        name: 'test'
      }
    } as PluginConfig

    expect(isValid(pluginConfigMissingPackageNam)).toBeDefined()
  })  
  it('should return error if deploy_plugin is not defined', () => {
    const pluginConfig = {
      is_it_deployed: {
        package_manager: 'test',
        package_name: 'test'
      }
    } as PluginConfig

    const error = isValid(pluginConfig)

    expect(error).toBeDefined()
  })
  it('should return error if deploy_plugin.name is not defined', () => {
    const pluginConfig = {
      is_it_deployed: {
        package_manager: 'test',
        package_name: 'test'
      },
      deploy_plugin: {}
    } as PluginConfig

    const error = isValid(pluginConfig)

    expect(error).toBeDefined()
  })
  it('should return undefined if config is valid, using is_it_deployed', () => {
    const pluginConfig = {
      is_it_deployed: {
        package_manager: 'npm',
        package_name: 'test'
      },
      deploy_plugin: {
        name: 'test'
      }
    } as PluginConfig

    const error = isValid(pluginConfig)

    expect(error).toBeUndefined()
  })
  it('should return undefined if config is valid, using should_skip_deployment_cmd', () => {
    const pluginConfig = {
      should_skip_deployment_cmd: 'test',
      deploy_plugin: {
        name: 'test'
      }
    } as PluginConfig

    const error = isValid(pluginConfig)

    expect(error).toBeUndefined()
  })  
})