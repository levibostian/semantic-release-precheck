import * as npm from './npm'

describe('getDeploymentPlugin', () => {
  it('should return undefined for a npm module not installed', async() => {
    expect(await npm.getDeploymentPlugin('not-installed')).toBeUndefined()
  })
  it('should return an object for a npm module already installed', async() => {
    let npmDeploymentPlugin = await npm.getDeploymentPlugin('@semantic-release/npm')
    expect(npmDeploymentPlugin).toBeDefined()
    expect(npmDeploymentPlugin?.publish).toBeDefined() // Helps us feel more confident the module was loaded because we should find a publish function. 
  })
})