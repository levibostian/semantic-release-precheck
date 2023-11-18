import { parse } from "./pluginConfig"

describe('parse', () => {

  describe('is_it_deployed', () => {
    test('should return error if is_it_deployed is not configured correctly', () => {
      const config = {
        is_it_deployed: {},
        deploy_plugin: 'some_plugin',
      };
      expect(parse(config)).toBeInstanceOf(Error);
    });
  })

  describe('deploy_plugin', () => { 
    test('should return error if deploy_plugin does not exist in config', () => {
      const config = {        
      };
      expect(parse(config)).toBeInstanceOf(Error);
    });

    test('should return error if deploy_plugin is not configured correctly', () => {
      const config = {
        deploy_plugin: ['some_plugin'],
      };
      expect(parse(config)).toBeInstanceOf(Error);
    });

    test('should accept deploy_plugin as string', () => {
      const config = {
        deploy_plugin: 'some_plugin',
      };
      expect(parse(config)).toEqual({
        deploy_plugin: {
          name: 'some_plugin',
          config: {},
        },
        check_after_publish: true,
      });
    })

    test('should accept deploy_plugin as array', () => {
      const config = {
        deploy_plugin: ['some_plugin', {foo: 'bar'}],
      };
      expect(parse(config)).toEqual({
        deploy_plugin: {
          name: 'some_plugin',
          config: {foo: 'bar'},
        },
        check_after_publish: true,
      })
    })
  })
  
  test('should return parsed PluginConfig if input is valid', () => {
    const config = {
      is_it_deployed: {
        package_manager: 'npm',
        package_name: 'my-package',
      },
      deploy_plugin: ['plugin_name', { configKey: 'configValue' }],
      should_skip_cmd: 'true',
      check_after_publish: false,
    };

    const expectedOutput = {
      is_it_deployed: {
        package_name: 'my-package',
        package_manager: 'npm',
      },
      should_skip_cmd: 'true',
      check_after_publish: false,
      deploy_plugin: {
        name: 'plugin_name',
        config: { configKey: 'configValue' },
      },
    };

    expect(parse(config)).toEqual(expectedOutput);
  });

  test('should return config with default values if not provided', () => {
    const config = {
      is_it_deployed: {
        package_manager: 'npm',
        package_name: 'my-package',
      },
      deploy_plugin: ['plugin_name', { configKey: 'configValue' }],
    };

    const expectedOutput = {
      is_it_deployed: {
        package_name: 'my-package',
        package_manager: 'npm',
      },
      check_after_publish: true,
      deploy_plugin: {
        name: 'plugin_name',
        config: { configKey: 'configValue' },
      },
    };

    expect(parse(config)).toEqual(expectedOutput);
  })
});