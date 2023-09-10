import { publish, verifyConditions, resetPlugin } from "./plugin"
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

beforeEach(() => {
  resetPlugin()
})

describe('handle deployment plugin installed or not installed', () => {

  let randomPluginConfig = { precheck_command: 'false', deploy_plugin: { name: "@semantic-release/npm" } }
  let mockPlugin: SemanticReleasePlugin

  beforeEach(() => {
    mockPlugin = getMockPlugin()
  })

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
  let randomPluginConfig: PluginConfig = { precheck_command: 'false', deploy_plugin: { name: "@semantic-release/npm" } }
  let mockPlugin: SemanticReleasePlugin

  beforeEach(async() => {
    mockPlugin = getMockPlugin()

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
    config.precheck_command = 'echo ${nextRelease.version}'

    await publish(config, context)

    expect(exec.runCommand).toBeCalledWith('echo 1.0.0', context)
  })

  it('should skip deployment if precheck command fails', async() => {
    let config = randomPluginConfig
    config.precheck_command = 'echo "will fail" && false'

    await publish(config, context)

    expect(mockPlugin.publish).not.toBeCalled()
  })

  it('should execute deployment if precheck command succeeds', async() => {
    let config = randomPluginConfig
    config.precheck_command = 'echo "will succeed"'
    let givenDeploymentConfig = { npmPublish: false, foo: "bar", nested: { isNested: 1 } }
    config.deploy_plugin.config = givenDeploymentConfig

    await publish(config, context)

    expect(mockPlugin.publish).toHaveBeenCalledWith(givenDeploymentConfig, context)
  })
})



