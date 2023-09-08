import * as npm from './npm'

describe('getDeploymentPlugin', () => {
  it('should return undefined for a npm module not installed', async() => {
    expect(await npm.getDeploymentPlugin('not-installed')).toBeUndefined()
  })
  it('should return an object for a npm module already installed', async() => {
    expect(await npm.getDeploymentPlugin('@semantic-release/npm')).toBeDefined()
  })
})