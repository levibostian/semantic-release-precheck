import { verifyConditions } from "./plugin"
import * as npm from "./npm"
import { FailContext, VerifyConditionsContext, VerifyReleaseContext } from 'semantic-release';
import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";

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

const mockPlugin: SemanticReleasePlugin = {
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

describe('handle deployment plugin installed or not installed', () => {

  it('should throw an error if the plugin is not installed', async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation(() => { return Promise.resolve(undefined) })

    await expect(verifyConditions({ name: 'plugin-name' }, context)).rejects.toThrowError()
  })

  it('should run the plugin if its already installed', async() => {
    jest.spyOn(npm, 'getDeploymentPlugin').mockImplementation((name: string) => { 
      return Promise.resolve(mockPlugin)
    })

    await verifyConditions({ name: 'plugin-name' }, context)

    expect(mockPlugin.verifyConditions).toBeCalled()
  })
})