import { publish, verifyConditions, generateNotes, resetPlugin, prepare, addChannel, fail, analyzeCommits, verifyRelease, success } from "./plugin"
import * as npm from "./npm"
import { AnalyzeCommitsContext, BaseContext, FailContext, PublishContext, VerifyConditionsContext, VerifyReleaseContext } from 'semantic-release';
import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";
import * as exec from "./exec";
import { PluginConfig } from "./type/pluginConfig";
import { Signale } from 'signale'
import { Writable as WritableStream } from "stream";

type SemanticReleaseContext = PublishContext & FailContext 

const context: SemanticReleaseContext = {
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

const randomPluginConfig: PluginConfig = { 
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
    config.should_skip_deployment_cmd = 'echo ${nextRelease.version}'

    await publish(config, context)

    expect(exec.runCommand).toBeCalledWith('echo 1.0.0', context)
  })

  it('should skip deployment if precheck command succeeds', async() => {
    let config = randomPluginConfig
    config.should_skip_deployment_cmd = 'echo "Looks like 1.0.0 already has been published to npm"'

    await publish(config, context)

    expect(mockPlugin.publish).not.toBeCalled()
  })

  it('should execute deployment if precheck command fails', async() => {
    let config = randomPluginConfig
    config.should_skip_deployment_cmd = 'echo "will fail" && false'
    let givenDeploymentConfig = { npmPublish: false, foo: "bar", nested: { isNested: 1 } }
    config.deploy_plugin.config = givenDeploymentConfig

    await publish(config, context)

    expect(mockPlugin.publish).toHaveBeenCalled()
  })
})

describe('skip future plugin functions if deployment is skipped', () => {
  it('should skip functions after publish', async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })
    let config = randomPluginConfig
    config.should_skip_deployment_cmd = 'echo "Looks like 1.0.0 already has been published to npm"'

    await runFullPluginLifecycle(config, context)

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
    config.should_skip_deployment_cmd = 'echo "will fail" && false'

    await runFullPluginLifecycle(config, context)    

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
    let config = randomPluginConfig
    config.deploy_plugin.config = undefined

    await runFullPluginLifecycle(config, context)        
    
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
    let config = randomPluginConfig
    let givenDeploymentConfig = { npmPublish: false, foo: "bar", nested: { isNested: 1 } }
    config.deploy_plugin.config = givenDeploymentConfig

    await verifyConditions(config, context)

    expect(mockPlugin.verifyConditions).toBeCalledWith(givenDeploymentConfig, expect.anything()) 
  })

  it('should provide semantic-release context to the deployment plugin for all functions', async() => {
    await runFullPluginLifecycle(randomPluginConfig, context)

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

    await runFullPluginLifecycle(randomPluginConfig, context)       

    expect(emptyMockPlugin).not.toHaveBeenCalled()
  })
})

describe('logging', () => {
  let contextWithLogger = context
  let logMock = jest.fn()

  beforeEach(async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => {
      return Promise.resolve(mockPlugin)
    })

    // Override the logger with a Signale instance that writes to a mock function. This tests the plugin's actual Signale behavior of modifying logs. 
    contextWithLogger = context 

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
  })

  it('should generate expected logs when deployment is not skipped', async() => {
    // create a copy of randomPluginConfig
    let config = randomPluginConfig
    config.should_skip_deployment_cmd = 'echo "run a deploy!" && false'

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
   
    await runFullPluginLifecycle(config, context)    
  
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

  it('should generate expected logs when deployment is skipped', async() => {
    // create a copy of randomPluginConfig
    let config = randomPluginConfig
    config.should_skip_deployment_cmd = 'echo "skip a deploy" && true'    
   
    await runFullPluginLifecycle(config, context)    
  
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
  "[semantic-release] › L  Will skip publish and future plugin functions for deploy plugin because precheck command returned a non-0 exit code.
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

