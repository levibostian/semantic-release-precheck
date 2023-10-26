import { publish, verifyConditions, generateNotes, resetPlugin, prepare, addChannel, fail, analyzeCommits, verifyRelease, success, prepareLoggerForDeploymentPlugin } from "./plugin"
import * as npm from "./npm"
import { BaseContext, FailContext, PublishContext } from 'semantic-release';
import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";
import * as exec from "./exec";
import { PluginConfig } from "./type/pluginConfig";
import { Signale } from 'signale'
import { Writable as WritableStream } from "stream";
import * as isItDeployed from 'is-it-deployed'
import * as git from "./git"

type SemanticReleaseContext = PublishContext & FailContext 

function defaultContext(): SemanticReleaseContext {
  return {
    env: {},
    envCi: {
      isCi: true,
      commit: '1234567890',
      branch: 'main',
    },
    logger: { // by default, provide an object that is not a Signale instance. Because the plugin modifies the logger instance for real Signale instances, it makes test assertions much harder. 
      log: () => {},
      error: () => {},
    } as Signale, 
    branch: {
      name: 'main'
    },
    branches: [{name: 'main'}],
    stderr: process.stderr,
    stdout: process.stdout,
    nextRelease: {
      channel: 'main',
      name: 'main',
      type: 'major',
      version: '1.0.0',
      gitTag: 'v1.0.0',
      gitHead: '1234567890',
      notes: 'Release notes'
    },
    commits: [],
    releases: [],
    lastRelease: {
      version: '',
      gitTag: '',
      channels: [],
      gitHead: '',
      name: '',
    },
    errors: {
      errors: [],
      message: '',
      name: ''
    }
  }
}

async function runFullPluginLifecycle(pluginConfig: PluginConfig, context: SemanticReleaseContext) {
  await verifyConditions(pluginConfig, context)
  await analyzeCommits(pluginConfig, context)
  await verifyRelease(pluginConfig, context)
  await generateNotes(pluginConfig, context)
  await prepare(pluginConfig, context)
  await publish(pluginConfig, context)
  await addChannel(pluginConfig, context)
  await success(pluginConfig, context)
  await fail(pluginConfig, context)
}

const getMockPlugin = (): SemanticReleasePlugin  => {
  return {
    verifyConditions: jest.fn(),
    analyzeCommits: jest.fn(),
    verifyRelease: jest.fn(),
    generateNotes: jest.fn(),
    prepare: jest.fn(),
    publish: jest.fn(),
    addChannel: jest.fn(),
    success: jest.fn(),
    fail: jest.fn(),
  }
}

function defaultPluginConfig(): PluginConfig {
  return { 
    should_skip_deployment_cmd: 'false', 
    deploy_plugin: { 
      name: "@semantic-release/npm", 
      config: { 
        foo: "bar", 
        nested: { 
          isNested: true 
        } 
      } 
    } 
  }
}

let mockPlugin: SemanticReleasePlugin

beforeEach(() => {
  resetPlugin()

  mockPlugin = getMockPlugin()

  // Dont try to actually run a delete tag command for any test. It will try to delete a tag on this git repo, haha!
  jest.spyOn(git, 'deleteTag').mockImplementation(() => { return Promise.resolve() })
})

describe('verify plugin config', () => {
  it('should throw error if plugin config is not valid', async() => {
    let config = defaultPluginConfig()
    config.should_skip_deployment_cmd = undefined
    config.is_it_deployed = undefined

    await expect(verifyConditions(config, defaultContext()))
    .rejects
    .toThrow();
  })
  it('should not throw error if plugin config is valid', async() => {
    let config = defaultPluginConfig()
    // must also make sure that plugin is installed or verifyConditions to not throw error 
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })

    await expect(verifyConditions(config, defaultContext()))
    .resolves
    .not
    .toThrow();
  })
})

describe('handle deployment plugin installed or not installed', () => {

  it('should throw an error if the plugin is not installed', async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation(() => { return Promise.resolve(undefined) })

    await expect(verifyConditions(defaultPluginConfig(), defaultContext())).rejects.toThrowError()
  })

  it('should run the plugin if its already installed', async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })

    await verifyConditions(defaultPluginConfig(), defaultContext())

    expect(mockPlugin.verifyConditions).toBeCalled()
  })
})

describe('publish - is_it_deployed', () => {  
  
  beforeEach(async() => {
    // This will load the mock plugin into the deploymentPlugin variable so that we can use it in the tests.
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })
    jest.spyOn(exec, 'runCommand').mockImplementation((command, context) => {
      return Promise.resolve(undefined)
    })
    await verifyConditions(defaultPluginConfig(), defaultContext())
  })

  it('should skip deployment if version already exists', async() => {
    let config = defaultPluginConfig()
    config.is_it_deployed = { 
      package_name: 'react', 
      package_manager: 'npm' 
    }
    let modifiedContext = defaultContext()
    modifiedContext.nextRelease.version = '18.0.0'

    await publish(config, modifiedContext)

    expect(mockPlugin.publish).not.toBeCalled()
    expect(exec.runCommand).not.toBeCalled() // make sure that a command didn't try to run to test deployment
  })

  it('should execute deployment if version does not exist', async() => {
    let config = defaultPluginConfig()
    config.is_it_deployed = { 
      package_name: 'react', 
      package_manager: 'npm' 
    }    
    let modifiedContext = defaultContext()
    modifiedContext.nextRelease.version = '99.99.99'

    await publish(config, modifiedContext)

    expect(mockPlugin.publish).toHaveBeenCalled()
    expect(exec.runCommand).not.toBeCalled() // make sure that a command didn't try to run to test deployment
  })
})

describe('publish - should_skip_deployment_cmd', () => {  
  
  beforeEach(async() => {
    // This will load the mock plugin into the deploymentPlugin variable so that we can use it in the tests.
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })
    await verifyConditions(defaultPluginConfig(), defaultContext())
  })

  it('should inject variable values into command', async() => {
    jest.spyOn(exec, 'runCommand').mockImplementation((command, context) => {
      return Promise.resolve(undefined)
    })

    let config = defaultPluginConfig()
    config.should_skip_deployment_cmd = 'echo ${nextRelease.version}'

    await publish(config, defaultContext())

    expect(exec.runCommand).toBeCalledWith('echo 1.0.0', expect.anything())
  })

  it('should skip deployment if precheck command succeeds', async() => {
    let config = defaultPluginConfig()
    config.should_skip_deployment_cmd = 'echo "Looks like 1.0.0 already has been published to npm"'

    await publish(config, defaultContext())

    expect(mockPlugin.publish).not.toBeCalled()
  })

  it('should execute deployment if precheck command fails', async() => {
    let config = defaultPluginConfig()
    config.should_skip_deployment_cmd = 'echo "will fail" && false'
    let givenDeploymentConfig = { npmPublish: false, foo: "bar", nested: { isNested: 1 } }
    config.deploy_plugin.config = givenDeploymentConfig

    await publish(config, defaultContext())

    expect(mockPlugin.publish).toHaveBeenCalled()
  })
})

describe('publish - check_if_deployed_after_publish', () => {  
  beforeEach(async() => { 
    // These mocks are needed to provide the mockPlugin to the plugin lifecycle functions.
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })
    jest.spyOn(exec, 'runCommand').mockImplementation((command, context) => {
      return Promise.resolve(undefined)
    })    
  })

  function getTestConfig(args: { isItDeployedReturnValues: boolean[], checkIfDeployedAfterPublish: boolean | undefined }) {    
    // Each test will use is_it_deployed to check if deployed. 
    // Setup mock here. 
    jest.spyOn(isItDeployed, 'isItDeployed').mockImplementation(() => { 
      return Promise.resolve(args.isItDeployedReturnValues.shift()!)
    })

    let config = defaultPluginConfig()
    config.check_if_deployed_after_publish = args.checkIfDeployedAfterPublish
    config.is_it_deployed = { // to make isItDeployedMock run 
      package_name: 'react', 
      package_manager: 'npm' 
    }
    let modifiedContext = defaultContext()
    modifiedContext.nextRelease.version = '18.0.0'

    return { config, modifiedContext }
  }

  it('should not check if deployed after publish if configured not to check', async() => {    
    const testConfig = getTestConfig({ 
      isItDeployedReturnValues: [false, true], 
      checkIfDeployedAfterPublish: false 
    })   

    await runFullPluginLifecycle(testConfig.config, testConfig.modifiedContext)

    expect(isItDeployed.isItDeployed).toHaveBeenCalledTimes(1)
  })

  it('should not check if deployed, as the default behavior when nil configuration provided', async() => {
    const testConfig = getTestConfig({ 
      isItDeployedReturnValues: [false, true], 
      checkIfDeployedAfterPublish: undefined 
    })   

    await runFullPluginLifecycle(testConfig.config, testConfig.modifiedContext)  

    expect(isItDeployed.isItDeployed).toHaveBeenCalledTimes(1)
  })

  it('should succeed if deployed check after publish succeeds', async() => {
    const testConfig = getTestConfig({ 
      isItDeployedReturnValues: [false, true], 
      checkIfDeployedAfterPublish: true 
    })   

    await runFullPluginLifecycle(testConfig.config, testConfig.modifiedContext) 

    expect(isItDeployed.isItDeployed).toHaveBeenCalledTimes(2)
  })

  it('should throw error if deployed check after publish says its not deployed', async() => {
    const testConfig = getTestConfig({ 
      isItDeployedReturnValues: [false, false], 
      checkIfDeployedAfterPublish: true 
    })   

    await expect(runFullPluginLifecycle(testConfig.config, testConfig.modifiedContext)).rejects.toThrowError()

    expect(isItDeployed.isItDeployed).toHaveBeenCalledTimes(2)
  })
})

describe('publish - handling deployment failures', () => {
  beforeEach(async() => { 
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => {
      return Promise.resolve(mockPlugin)
    })
  })


  describe('expect to delete git tag', () => {
    it('should delete git tag if deployment plugin throws an error', async() => {
      mockPlugin.publish = jest.fn().mockImplementation((config, context) => {
        throw new Error('')
      })
  
      await expect(runFullPluginLifecycle(defaultPluginConfig(), defaultContext())).rejects.toThrowError()
  
      expect(git.deleteTag).toBeCalledWith('v1.0.0', expect.anything())
    })
  
    it('should not delete git tag if deployment plugin succeeds', async() => {
      mockPlugin.publish = jest.fn().mockImplementation((config, context) => {
        return Promise.resolve()
      })
  
      await runFullPluginLifecycle(defaultPluginConfig(), defaultContext())
  
      expect(git.deleteTag).not.toBeCalled()
    })
  
    it('should delete git tag if deployment check after publish says that deployment didnt succeed', async() => {
      mockPlugin.publish = jest.fn().mockImplementation((config, context) => {
        return Promise.resolve()
      })    
      jest.spyOn(isItDeployed, 'isItDeployed').mockImplementation(() => { 
        return Promise.resolve(false) // always return false to simulate deployment never succeeding 
      })
      let config = defaultPluginConfig()
      config.check_if_deployed_after_publish = true
      config.is_it_deployed = { // to make isItDeployedMock run 
        package_name: 'react', 
        package_manager: 'npm' 
      }
  
      await expect(runFullPluginLifecycle(config, defaultContext())).rejects.toThrowError()
  
      expect(git.deleteTag).toBeCalledWith('v1.0.0', expect.anything())
    })
  
    it('should not delete git tag if deployment check after publish says that deployment succeeded', async() => {
      mockPlugin.publish = jest.fn().mockImplementation((config, context) => {
        return Promise.resolve()
      })
      const isItDeployedReturnValues = [false, true]
      jest.spyOn(isItDeployed, 'isItDeployed').mockImplementation(() => { 
        return Promise.resolve(isItDeployedReturnValues.shift()!)
      })
      let config = defaultPluginConfig()
      config.check_if_deployed_after_publish = true
      config.is_it_deployed = { // to make isItDeployedMock run 
        package_name: 'react', 
        package_manager: 'npm' 
      }
  
      await runFullPluginLifecycle(config, defaultContext())
  
      expect(git.deleteTag).not.toBeCalled()
    })
  })

  describe('expect publish step to throw error', () => {
    it('plugin publish step should throw error if deployment plugin also threw an error', async() => { 
      const givenDeployPluginErrorMessage = "publish failed"
  
     mockPlugin.publish = jest.fn().mockImplementation((config, context) => {
       throw new Error(givenDeployPluginErrorMessage)
     })
  
     await expect(runFullPluginLifecycle(defaultPluginConfig(), defaultContext())).rejects.toThrow(givenDeployPluginErrorMessage)
   })

    it('plugin publish step should throw error if deployment check after publish says that deployment didnt succeed', async() => {
      mockPlugin.publish = jest.fn().mockImplementation((config, context) => {
        return Promise.resolve()
      })    
      jest.spyOn(isItDeployed, 'isItDeployed').mockImplementation(() => { 
        return Promise.resolve(false) // always return false to simulate deployment never succeeding 
      })
      let config = defaultPluginConfig()
      config.check_if_deployed_after_publish = true
      config.is_it_deployed = { // to make isItDeployedMock run 
        package_name: 'react', 
        package_manager: 'npm' 
      }

      await expect(runFullPluginLifecycle(config, defaultContext())).rejects.toThrowErrorMatchingInlineSnapshot(`"Publish plugin, @semantic-release/npm, successfully ran. But after checking npm, the version 1.0.0 was not found. Therefore, the publish plugin may have not executed successfully."`)
    })
  })
})

describe('skip future plugin functions if deployment is skipped', () => {
  it('should skip functions after publish', async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })
    let config = defaultPluginConfig()
    config.should_skip_deployment_cmd = 'echo "Looks like 1.0.0 already has been published to npm"'

    await runFullPluginLifecycle(config, defaultContext())

    expect(mockPlugin.publish).not.toBeCalled()
    expect(mockPlugin.addChannel).not.toBeCalled()
    expect(mockPlugin.success).not.toBeCalled()
    expect(mockPlugin.fail).not.toBeCalled()
  })

  it('should not skip functions after publish if deployment is not skipped', async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })
    let config = defaultPluginConfig()
    config.should_skip_deployment_cmd = 'echo "will fail" && false'

    await runFullPluginLifecycle(config, defaultContext())    

    expect(mockPlugin.publish).toBeCalled()
    expect(mockPlugin.addChannel).toBeCalled()
    expect(mockPlugin.success).toBeCalled()
    expect(mockPlugin.fail).toBeCalled()    
  })
})

describe('behavior of running deployment plugin', () => {
  beforeEach(async() => { 
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => {
      return Promise.resolve(mockPlugin)
    })
  })

  it('should provide empty object if no config is provided', async() => {
    let config = defaultPluginConfig()
    config.deploy_plugin.config = undefined

    await runFullPluginLifecycle(config, defaultContext())        
    
    expect((mockPlugin.verifyConditions as jest.Mock).mock.calls[0][0]).toEqual({})
    expect((mockPlugin.analyzeCommits as jest.Mock).mock.calls[0][0]).toEqual({})
    expect((mockPlugin.verifyRelease as jest.Mock).mock.calls[0][0]).toEqual({})
    expect((mockPlugin.generateNotes as jest.Mock).mock.calls[0][0]).toEqual({})
    expect((mockPlugin.prepare as jest.Mock).mock.calls[0][0]).toEqual({})
    expect((mockPlugin.publish as jest.Mock).mock.calls[0][0]).toEqual({})
    expect((mockPlugin.addChannel as jest.Mock).mock.calls[0][0]).toEqual({})
    expect((mockPlugin.success as jest.Mock).mock.calls[0][0]).toEqual({})
    expect((mockPlugin.fail as jest.Mock).mock.calls[0][0]).toEqual({})    
  })

  it('should provide deployment plugin config if config is provided', async() => {
    let config = defaultPluginConfig()
    let givenDeploymentConfig = { npmPublish: false, foo: "bar", nested: { isNested: 1 } }
    config.deploy_plugin.config = givenDeploymentConfig

    await verifyConditions(config, defaultContext())

    expect(mockPlugin.verifyConditions).toBeCalledWith(givenDeploymentConfig, expect.anything()) 
  })

  it('should provide semantic-release context to the deployment plugin for all functions', async() => {
    let context = defaultContext()
    await runFullPluginLifecycle(defaultPluginConfig(), context)

    expect(mockPlugin.verifyConditions).toBeCalledWith(expect.anything(), expect.objectContaining(context))
    expect(mockPlugin.analyzeCommits).toBeCalledWith(expect.anything(), expect.objectContaining(context))
    expect(mockPlugin.verifyRelease).toBeCalledWith(expect.anything(), expect.objectContaining(context))
    expect(mockPlugin.generateNotes).toBeCalledWith(expect.anything(), expect.objectContaining(context))
    expect(mockPlugin.prepare).toBeCalledWith(expect.anything(), expect.objectContaining(context))
    expect(mockPlugin.publish).toBeCalledWith(expect.anything(), expect.objectContaining(context))
    expect(mockPlugin.addChannel).toBeCalledWith(expect.anything(), expect.objectContaining(context))
    expect(mockPlugin.success).toBeCalledWith(expect.anything(), expect.objectContaining(context))
    expect(mockPlugin.fail).toBeCalledWith(expect.anything(), expect.objectContaining(context))
  })

  it('should not run plugin function if plugin function is not defined', async() => {
    let emptyMockPlugin = jest.fn() 
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => {
      return Promise.resolve(emptyMockPlugin as SemanticReleasePlugin)
    })

    await runFullPluginLifecycle(defaultPluginConfig(), defaultContext())       

    expect(emptyMockPlugin).not.toHaveBeenCalled()
  })
})

describe('prepareLoggerForDeploymentPlugin', () => {
  it('should return context (and not crash) if semantic-release modifies the logger they use', () => {
    let context = { logger: {} } as BaseContext // provide a logger that is not a Signale instance. In case semantic-release ever changes the lib they use for logging, we want to be compatible.

    const actualContext = prepareLoggerForDeploymentPlugin(context, defaultPluginConfig())

    expect(actualContext).toEqual(context)
  })
})

describe('logging', () => {
  let contextWithLogger = defaultContext()
  let logMock = jest.fn()

  beforeEach(async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => {
      return Promise.resolve(mockPlugin)
    })

    // Override the logger with a Signale instance that writes to a mock function. This tests the plugin's actual Signale behavior of modifying logs. 
    contextWithLogger = defaultContext() 

    const consoleStream = new WritableStream()    
    consoleStream.write = logMock

    contextWithLogger.logger = new Signale({ // copy/paste from https://github.com/semantic-release/semantic-release/blob/master/lib/get-logger.js
      config: { displayTimestamp: false, underlineMessage: false, displayLabel: false }, // disable timestamps because we are using snapshot testing 
      disabled: false,
      interactive: false,
      scope: "semantic-release",
      stream: [consoleStream as NodeJS.WriteStream],
      types: {
        error: { badge: 'E', color: "white", label: "", stream: [consoleStream as NodeJS.WriteStream] },
        log: { badge: 'L', color: "white", label: "", stream: [consoleStream as NodeJS.WriteStream] },
        success: { badge: 'S', color: "white", label: "", stream: [consoleStream as NodeJS.WriteStream] },
      },
    })

    // mock plugin functions to log something useful to test logs. 
    mockPlugin.publish = jest.fn().mockImplementation((config, context) => {
      context.logger.log('running publish')
    })
    mockPlugin.addChannel = jest.fn().mockImplementation((config, context) => {
      context.logger.log('running add channel')
    })
    mockPlugin.success = jest.fn().mockImplementation((config, context) => {
      context.logger.log('running success')
    })
    mockPlugin.fail = jest.fn().mockImplementation((config, context) => {
      context.logger.log('running fail')
    })
  })

  it('should generate expected logs when deployment is not skipped', async() => {
    // create a copy of randomPluginConfig
    let config = defaultPluginConfig()
    config.should_skip_deployment_cmd = 'echo "run a deploy!" && false'    
   
    await runFullPluginLifecycle(config, contextWithLogger)    
  
    const actualLogs = logMock.mock.calls.flatMap((call) => call[0])

    expect(actualLogs).toMatchInlineSnapshot(`
[
  "[semantic-release] › L  Running verifyConditions for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running analyzeCommits for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running verifyRelease for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running generateNotes for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running prepare for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Will run precheck command: 'echo "run a deploy!" && false' - If command returns true (0 exit code), the deployment will be skipped.
",
  "[semantic-release] › L  Running command. Output of command will be displayed below....
",
  "[semantic-release] [@semantic-release/npm] › L  run a deploy!

",
  "[semantic-release] › L  Running publish for deployment plugin: @semantic-release/npm
",
  "[semantic-release] [@semantic-release/npm] › L  running publish
",
  "[semantic-release] › L  Running addChannel for deployment plugin: @semantic-release/npm
",
  "[semantic-release] [@semantic-release/npm] › L  running add channel
",
  "[semantic-release] › L  Running success for deployment plugin: @semantic-release/npm
",
  "[semantic-release] [@semantic-release/npm] › L  running success
",
  "[semantic-release] › L  Running fail for deployment plugin: @semantic-release/npm
",
  "[semantic-release] [@semantic-release/npm] › L  running fail
",
]
`)
  })

  it('should generate expected logs when publish deployment plugin throws error', async() => {    
    mockPlugin.publish = jest.fn().mockImplementation((config, context) => {
      throw new Error('publish failed')
    })
   
    await expect(runFullPluginLifecycle(defaultPluginConfig(), contextWithLogger)).rejects.toThrowError()
  
    const actualLogs = logMock.mock.calls.flatMap((call) => call[0])

    expect(actualLogs).toMatchInlineSnapshot(`
[
  "[semantic-release] › L  Running verifyConditions for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running analyzeCommits for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running verifyRelease for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running generateNotes for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running prepare for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Will run precheck command: 'false' - If command returns true (0 exit code), the deployment will be skipped.
",
  "[semantic-release] › L  Running command. Output of command will be displayed below....
",
  "[semantic-release] › L  Running publish for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Looks like something went wrong during the deployment. No worries! I will try to help by cleaning up after the failed deployment so you can re-try the deployment if you wish.
",
  "[semantic-release] › L  Deleting git tag v1.0.0...
",
  "[semantic-release] › L  Done! Cleanup is complete and you should be able to retry the deployment now.
",
]
`)
  })

  it('should generate expected logs when deployment is skipped, using should_skip_deployment_cmd', async() => {
    // create a copy of randomPluginConfig
    let config = defaultPluginConfig()
    config.should_skip_deployment_cmd = 'echo "skip a deploy" && true'    
   
    await runFullPluginLifecycle(config, contextWithLogger)    
  
    const actualLogs = logMock.mock.calls.flatMap((call) => call[0])

    expect(actualLogs).toMatchInlineSnapshot(`
[
  "[semantic-release] › L  Running verifyConditions for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running analyzeCommits for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running verifyRelease for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running generateNotes for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running prepare for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Will run precheck command: 'echo "skip a deploy" && true' - If command returns true (0 exit code), the deployment will be skipped.
",
  "[semantic-release] › L  Running command. Output of command will be displayed below....
",
  "[semantic-release] [@semantic-release/npm] › L  skip a deploy

",
  "[semantic-release] › L  Will skip publish and future plugin functions for deploy plugin because version 1.0.0 is already deployed.
",
  "[semantic-release] › L  Skipping addChannel for deploy plugin @semantic-release/npm because publish was skipped.
",
  "[semantic-release] › L  Skipping success for deploy plugin @semantic-release/npm because publish was skipped.
",
  "[semantic-release] › L  Skipping fail for deploy plugin @semantic-release/npm because publish was skipped.
",
]
`)
  })

  it('should generate expected logs when deployment is skipped, using is_it_deployed', async() => {
    // create a copy of randomPluginConfig
    let config = defaultPluginConfig()
    config.is_it_deployed = {
      package_name: 'react',
      package_manager: 'npm'
    }
    contextWithLogger.nextRelease.version = '18.0.0'
   
    await runFullPluginLifecycle(config, contextWithLogger)    
  
    const actualLogs = logMock.mock.calls.flatMap((call) => call[0])

    expect(actualLogs).toMatchInlineSnapshot(`
[
  "[semantic-release] › L  Running verifyConditions for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running analyzeCommits for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running verifyRelease for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running generateNotes for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Running prepare for deployment plugin: @semantic-release/npm
",
  "[semantic-release] › L  Checking if version 18.0.0 of package react is already deployed to npm.
",
  "[semantic-release] › L  Will skip publish and future plugin functions for deploy plugin because version 18.0.0 is already deployed.
",
  "[semantic-release] › L  Skipping addChannel for deploy plugin @semantic-release/npm because publish was skipped.
",
  "[semantic-release] › L  Skipping success for deploy plugin @semantic-release/npm because publish was skipped.
",
  "[semantic-release] › L  Skipping fail for deploy plugin @semantic-release/npm because publish was skipped.
",
]
`)
  })
})

