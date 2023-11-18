
import { State } from './plugin';
import { defaultContext } from './plugin.spec';
import { isAlreadyDeployed } from './util';
import * as isItDeployed from 'is-it-deployed';

describe('isAlreadyDeployed', () => {  
  it('should return false when not providing any configuration', async() => {
    const givenState = {
      pluginConfig: {},
    } as State;
    const givenContext = defaultContext()

    expect(await isAlreadyDeployed(givenContext, givenState)).toBe(false);
  })

  describe('use is_it_deployed', () => {
    
    test('should return false when is_it_deployed returns false', async () => {    
      const givenState = {
        pluginConfig: {
          is_it_deployed: {
            package_name: 'jest',
            package_manager: 'npm',
          },
        },
      } as State;
      const givenContext = defaultContext()
      givenContext.nextRelease.version = '999.999.999';    
  
      expect(await isAlreadyDeployed(givenContext, givenState)).toBe(false);
    });

    test('should return true when is_it_deployed returns true', async () => {    
      const givenState = {
        pluginConfig: {
          is_it_deployed: {
            package_name: 'jest',
            package_manager: 'npm',
          },
        },
      } as State;
      const givenContext = defaultContext()
      givenContext.nextRelease.version = '29.7.0';
  
      expect(await isAlreadyDeployed(givenContext, givenState)).toBe(true);
    });

    test('should return true when is_it_deployed returns true and should_skip_cmd returns false', async () => {
      const givenState = {
        pluginConfig: {
          is_it_deployed: {
            package_name: 'jest',
            package_manager: 'npm',
          },
          should_skip_cmd: 'false',
        },        
      } as State;
      const givenContext = defaultContext()
      givenContext.nextRelease.version = '29.7.0';
  
      expect(await isAlreadyDeployed(givenContext, givenState)).toBe(true);
    });
  })

  describe('use should_skip_cmd', () => {
    test('should return false when is_it_deployed returns false', async () => {    
      const givenState = {
        pluginConfig: {
          is_it_deployed: undefined,
          should_skip_cmd: 'false',
        },
      } as State;
  
      expect(await isAlreadyDeployed(defaultContext(), givenState)).toBe(false);
    });

    test('should return true when is_it_deployed returns true', async () => {    
      const givenState = {
        pluginConfig: {
          is_it_deployed: undefined,
          should_skip_cmd: 'true',
        },
      } as State;
  
      expect(await isAlreadyDeployed(defaultContext(), givenState)).toBe(true);
    });

    test('should return true when is_it_deployed returns false and should_skip_cmd returns true', async () => {
      const givenState = {
        pluginConfig: {
          is_it_deployed: {
            package_name: 'jest',
            package_manager: 'npm',
          },
          should_skip_cmd: 'true',
        }, 
      } as State;
      const givenContext = defaultContext()
      givenContext.nextRelease.version = '99.99.99';
  
      expect(await isAlreadyDeployed(givenContext, givenState)).toBe(true);
    });
  })  
});
