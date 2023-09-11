import { publish, verifyConditions, generateNotes, resetPlugin, prepare, addChannel, fail, analyzeCommits, verifyRelease, success } from "./plugin"
import * as npm from "./npm"
import { FailContext, VerifyConditionsContext, VerifyReleaseContext } from 'semantic-release';
import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";
import * as exec from "./exec";
import { PluginConfig } from "./type/pluginConfig";

let context: VerifyConditionsContext & VerifyReleaseContext & FailContext = {
  env: {},
  envCi: {
    isCi: true,
    commit: '1234567890',
    branch: 'main',
  },
  logger: {
    log: (message: string) => {
      console.log(message)
    },
    error: (message: string) => {
      console.log(message)
    }
  },
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

const getMockPlugin = (): SemanticReleasePlugin => {
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

const randomPluginConfig: PluginConfig = { 
  shoud_skip_deployment_cmd: 'false', 
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
let mockPlugin: SemanticReleasePlugin

beforeEach(() => {
  resetPlugin()

  mockPlugin = getMockPlugin()
})

describe('handle deployment plugin installed or not installed', () => {

  it('should throw an error if the plugin is not installed', async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation(() => { return Promise.resolve(undefined) })

    await expect(verifyConditions(randomPluginConfig, context)).rejects.toThrowError()
  })

  it('should run the plugin if its already installed', async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })

    await verifyConditions(randomPluginConfig, context)

    expect(mockPlugin.verifyConditions).toBeCalled()
  })
})

describe('publish', () => {  
  
  beforeEach(async() => {
    // This will load the mock plugin into the deploymentPlugin variable so that we can use it in the tests.
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })
    await verifyConditions(randomPluginConfig, context)
  })

  it('should inject variable values into command', async() => {
    jest.spyOn(exec, 'runCommand').mockImplementation((command, context) => {
      return Promise.resolve(undefined)
    })

    let config = randomPluginConfig
    config.shoud_skip_deployment_cmd = 'echo ${nextRelease.version}'

    await publish(config, context)

    expect(exec.runCommand).toBeCalledWith('echo 1.0.0', context)
  })

  it('should skip deployment if precheck command succeeds', async() => {
    let config = randomPluginConfig
    config.shoud_skip_deployment_cmd = 'echo "Looks like 1.0.0 already has been published to npm"'

    await publish(config, context)

    expect(mockPlugin.publish).not.toBeCalled()
  })

  it('should execute deployment if precheck command fails', async() => {
    let config = randomPluginConfig
    config.shoud_skip_deployment_cmd = 'echo "will fail" && false'
    let givenDeploymentConfig = { npmPublish: false, foo: "bar", nested: { isNested: 1 } }
    config.deploy_plugin.config = givenDeploymentConfig

    await publish(config, context)

    expect(mockPlugin.publish).toHaveBeenCalledWith(givenDeploymentConfig, context)
  })
})

describe('skip future plugin functions if deployment is skipped', () => {
  it('should skip functions after publish', async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })
    let config = randomPluginConfig
    config.shoud_skip_deployment_cmd = 'echo "Looks like 1.0.0 already has been published to npm"'

    await verifyConditions(config, context)
    await analyzeCommits(config, context)
    await verifyRelease(config, context)
    await generateNotes(config, context)
    await prepare(config, context)
    await publish(config, context)
    await addChannel(config, context)
    await success(config, context)
    await fail(config, context)

    expect(mockPlugin.verifyConditions).toBeCalledWith(config.deploy_plugin.config, context)
    expect(mockPlugin.analyzeCommits).toBeCalledWith(config.deploy_plugin.config, context)
    expect(mockPlugin.verifyRelease).toBeCalledWith(config.deploy_plugin.config, context)
    expect(mockPlugin.generateNotes).toBeCalledWith(config.deploy_plugin.config, context)
    expect(mockPlugin.prepare).toBeCalledWith(config.deploy_plugin.config, context)

    expect(mockPlugin.publish).not.toBeCalled()
    expect(mockPlugin.addChannel).not.toBeCalled()
    expect(mockPlugin.success).not.toBeCalled()
    expect(mockPlugin.fail).not.toBeCalled()
  })

  it('should not skip functions after publish if deployment is not skipped', async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })
    let config = randomPluginConfig
    config.shoud_skip_deployment_cmd = 'echo "will fail" && false'

    await verifyConditions(config, context)
    await analyzeCommits(config, context)
    await verifyRelease(config, context)
    await generateNotes(config, context)
    await prepare(config, context)
    await publish(config, context)
    await addChannel(config, context)
    await success(config, context)
    await fail(config, context)

    expect(mockPlugin.verifyConditions).toBeCalledWith(config.deploy_plugin.config, context)
    expect(mockPlugin.analyzeCommits).toBeCalledWith(config.deploy_plugin.config, context)
    expect(mockPlugin.verifyRelease).toBeCalledWith(config.deploy_plugin.config, context)
    expect(mockPlugin.generateNotes).toBeCalledWith(config.deploy_plugin.config, context)
    expect(mockPlugin.prepare).toBeCalledWith(config.deploy_plugin.config, context)
    expect(mockPlugin.publish).toBeCalledWith(config.deploy_plugin.config, context)
    expect(mockPlugin.addChannel).toBeCalledWith(config.deploy_plugin.config, context)
    expect(mockPlugin.success).toBeCalledWith(config.deploy_plugin.config, context)
    expect(mockPlugin.fail).toBeCalledWith(config.deploy_plugin.config, context)
  })
})

describe('behavior of running deployment plugin', () => {
  beforeEach(async() => { 
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => {
      return Promise.resolve(mockPlugin)
    })
  })

  it('should provide empty object if no config is provided', async() => {
    let config = randomPluginConfig
    config.deploy_plugin.config = undefined

    await verifyConditions(config, context)
    await analyzeCommits(config, context)
    await verifyRelease(config, context)
    await generateNotes(config, context)
    await prepare(config, context)
    await publish(config, context)
    await addChannel(config, context)
    await success(config, context)
    await fail(config, context)

    expect(mockPlugin.verifyConditions).toBeCalledWith({}, context)    
    expect(mockPlugin.analyzeCommits).toBeCalledWith({}, context)
    expect(mockPlugin.verifyRelease).toBeCalledWith({}, context)
    expect(mockPlugin.generateNotes).toBeCalledWith({}, context)
    expect(mockPlugin.prepare).toBeCalledWith({}, context)
    expect(mockPlugin.publish).toBeCalledWith({}, context)
    expect(mockPlugin.addChannel).toBeCalledWith({}, context)
    expect(mockPlugin.success).toBeCalledWith({}, context)
    expect(mockPlugin.fail).toBeCalledWith({}, context)   
  })

  it('should provide config if config is provided', async() => {
    let config = randomPluginConfig
    let givenDeploymentConfig = { npmPublish: false, foo: "bar", nested: { isNested: 1 } }
    config.deploy_plugin.config = givenDeploymentConfig

    await verifyConditions(config, context)
    

    expect(mockPlugin.verifyConditions).toBeCalledWith(givenDeploymentConfig, context)         
  })

  it('should not run plugin function if plugin function is not defined', async() => {
    let emptyMockPlugin = jest.fn() 
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => {
      return Promise.resolve(emptyMockPlugin as SemanticReleasePlugin)
    })

    await verifyConditions(randomPluginConfig, context)
    await analyzeCommits(randomPluginConfig, context)
    await verifyRelease(randomPluginConfig, context)
    await generateNotes(randomPluginConfig, context)
    await prepare(randomPluginConfig, context)
    await publish(randomPluginConfig, context)
    await addChannel(randomPluginConfig, context)
    await success(randomPluginConfig, context)
    await fail(randomPluginConfig, context)

    expect(emptyMockPlugin).not.toHaveBeenCalled()
  })
})


