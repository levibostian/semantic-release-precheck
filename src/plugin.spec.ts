import { publish, verifyConditions, generateNotes, prepare, addChannel, fail, analyzeCommits, verifyRelease, success, resetState, state } from "./plugin"
import * as npm from "./npm"
import { BaseContext, FailContext, PublishContext } from 'semantic-release';
import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";
import * as exec from "./exec";
import { PluginConfig } from "./type/pluginConfig";
import { Signale } from 'signale'
import { Writable as WritableStream } from "stream";
import * as isItDeployed from 'is-it-deployed'
import * as steps from './util'

type SemanticReleaseContext = PublishContext & FailContext 

export function defaultContext(): SemanticReleaseContext {
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

async function runFullPluginLifecycle(rawConfig: any, context: SemanticReleaseContext) {
  await verifyConditions(rawConfig, context)
  await analyzeCommits({}, context)
  await verifyRelease({}, context)
  await generateNotes({}, context)
  await prepare({}, context)
  await publish({}, context)
  await addChannel({}, context)
  await success({}, context)
  await fail({}, context)
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
    should_skip_cmd: 'false', 
    check_after_publish: false,
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
  resetState()

  mockPlugin = getMockPlugin()  

  jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
    return Promise.resolve(mockPlugin)
  })
})

describe('verifyConditions', () => {
  it('should throw error if plugin config is not valid', async() => {
    await expect(verifyConditions({ am_i_valid: false }, defaultContext()))
    .rejects
    .toThrow();
  })
  it('should not throw error if plugin config is valid', async() => {        
    await expect(verifyConditions({
      deploy_plugin: '@semantic-release/npm'
    }, defaultContext()))
    .resolves
    .not
    .toThrow();
  })

  it('should throw if deployment plugin is not installed via npm', async() => {
    // must also make sure that plugin is installed or verifyConditions to not throw error 
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(undefined)
    })

    await expect(verifyConditions({
      deploy_plugin: '@semantic-release/npm'
    }, defaultContext()))
    .rejects
    .toThrow();
  })
})

describe('publish', () => {  

  beforeEach(() => {
    // state gets set during verifyConditions. Set here to not have to call it. 
    state.pluginConfig = defaultPluginConfig()
    state.deploymentPlugin = mockPlugin
  })

  describe('precheck', () => {
    it('should skip running publish step if precheck says that package is already deployed', async() => {
      jest.spyOn(steps, 'isAlreadyDeployed').mockImplementation(() => Promise.resolve(true))
  
      await publish({}, defaultContext())
  
      expect(mockPlugin.publish).not.toHaveBeenCalled()
    })
  
    it('should run publish step if precheck says that package is not already deployed', async() => {
      jest.spyOn(steps, 'isAlreadyDeployed').mockImplementation(() => Promise.resolve(false))
  
      await publish({}, defaultContext())
  
      expect(mockPlugin.publish).toHaveBeenCalled()
    })
  })

  describe('run deploy plugin', () => {
    beforeEach(() => {
      jest.spyOn(steps, 'isAlreadyDeployed').mockImplementation(() => Promise.resolve(false)) // to run publish step of deploy plugin 

      state.pluginConfig.check_after_publish = false // to skip check after publish step
    })

    it('should run publish step of deploy plugin', async() => {
      await publish({}, defaultContext())

      expect(mockPlugin.publish).toHaveBeenCalled()
    })

    it('should throw if deploy plugin publish throws', async() => {
      mockPlugin.publish = jest.fn().mockImplementation(() => {
        throw new Error('publish failed')
      })

      await expect(publish({}, defaultContext())).rejects.toThrow()      

      expect(mockPlugin.publish).toHaveBeenCalled()
    })
  })

  describe('check_after_publish', () => {

    beforeEach(() => {
      jest.spyOn(steps, 'isAlreadyDeployed').mockImplementation(() => Promise.resolve(false)) // to run mockPlugin.publish

      state.pluginConfig.check_after_publish = true
    })

    it('should not run check after publish if check_after_publish is false', async() => {
      state.pluginConfig.check_after_publish = false

      await expect(publish({}, defaultContext())).resolves.not.toThrow()

      expect(steps.isAlreadyDeployed).toHaveBeenCalledTimes(1)
    })

    it('should not throw error if check after publish succeeds', async() => {
      state.pluginConfig.check_after_publish = true

      jest.spyOn(steps, 'isAlreadyDeployed').mockImplementationOnce(() => Promise.resolve(false)) // to run mockPlugin.publish
                                            .mockImplementationOnce(() => Promise.resolve(true)) // to run check after publish
      
      await expect(publish({}, defaultContext())).resolves.not.toThrow()

      expect(steps.isAlreadyDeployed).toHaveBeenCalledTimes(2)
    })

    it('should throw error if check after publish fails', async() => {
      state.pluginConfig.check_after_publish = true

      jest.spyOn(steps, 'isAlreadyDeployed').mockImplementationOnce(() => Promise.resolve(false)) // to run mockPlugin.publish
                                            .mockImplementationOnce(() => Promise.resolve(false)) // to run check after publish

      await expect(publish({}, defaultContext())).rejects.toThrow()

      expect(steps.isAlreadyDeployed).toHaveBeenCalledTimes(2)
    })    
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
  })

  it('should generate expected logs when deployment is not skipped', async() => {   
    await runFullPluginLifecycle({
      deploy_plugin: '@semantic-release/npm',
      should_skip_cmd: 'echo "run a deploy!" && false',
      check_after_publish: false
    }, contextWithLogger)    
  
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
  "[semantic-release] › L  Running command: 'echo "run a deploy!" && false'... (Output of command will be displayed below)
",
  "[semantic-release] [@semantic-release/npm] › L  run a deploy!

",
  "[semantic-release] › L  Command was not successful (did not return exit code 0).
",
  "[semantic-release] › L  The plugin: @semantic-release/npm will continue to run as normal.
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
]
`)
  })

  it('should generate expected logs when publish deployment plugin throws error', async() => {    
    mockPlugin.publish = jest.fn().mockImplementation((config, context) => {
      throw new Error('publish failed')
    })
   
    await expect(runFullPluginLifecycle({
      deploy_plugin: '@semantic-release/npm',
      check_after_publish: false
    }, contextWithLogger)).rejects.toThrowError()
  
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
  "[semantic-release] › L  The plugin: @semantic-release/npm will continue to run as normal.
",
  "[semantic-release] › L  Running publish for deployment plugin: @semantic-release/npm
",
]
`)
  })

  it('should generate expected logs when deployment is skipped', async() => {   
    await runFullPluginLifecycle({
      deploy_plugin: '@semantic-release/npm',
      should_skip_cmd: 'echo "skip a deploy" && true',
      check_after_publish: false
    }, contextWithLogger)
  
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
  "[semantic-release] › L  Running command: 'echo "skip a deploy" && true'... (Output of command will be displayed below)
",
  "[semantic-release] [@semantic-release/npm] › L  skip a deploy

",
  "[semantic-release] › L  Command was successful (return exit code 0).
",
  "[semantic-release] › L  The plugin: @semantic-release/npm will be skipped for version 1.0.0.
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

