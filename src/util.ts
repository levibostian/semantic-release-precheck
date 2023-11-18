import { BaseContext, PublishContext } from 'semantic-release'
import { State } from './plugin'
import { runCommand } from "./exec";
import stringFormat from 'lodash.template';
import * as isItDeployed from 'is-it-deployed'

// semantic-release uses a lib called signale for logging. This lib helps semantic-release make logs better by telling you what plugin is executing. 
// Because this plugin's job is to execute another plugin, we want to do the same thing that semantic-release does to show when the deploy plugin is executing. 
// We should see logs such as: 
// [semantic-release] [semantic-release-precheck] Running verifyConditions for deployment plugin: @semantic-release/npm
// [semantic-release] [@semantic-release/npm] running publish step here. 
// Depending on what plugin is running, our precheck plugin or the deploy plugin. 
// 
// This function modifies the context object with the modified logger so we can send the modified context to the deploy plugin.
export function prepareLoggerForDeploymentPlugin<CONTEXT>(context: BaseContext, state: State): CONTEXT {
  let logger = context.logger 

  // the logic for how to modify the logger is from: https://github.com/semantic-release/semantic-release/blob/e759493e074650748fc3bbef9e640db413b52d56/lib/plugins/normalize.js#L40
  if (logger.scope && logger.scope instanceof Function) { // check if the logger has a scope function before calling it to try to be compatible if semantic-release ever changes the lib they use for logging 
    // we need to get the existing scopes, convert it to an array, add the name of the plugin, then use that to modify the existing logger. 
    let existingScopes: string[] | string = (logger as any).scopeName
    if (typeof existingScopes === "string") {
      existingScopes = [existingScopes]
    }
    existingScopes.push(state.pluginConfig.deploy_plugin.name)

    logger = logger.scope(...existingScopes)
  }

  // We want to return a new object so we don't modify the original context object. Our own plugin still uses the original context object.
  // return a new one that is only passed to the deploy plugin.
  let modifiedContext = Object.assign({}, context)
  modifiedContext.logger = logger

  return modifiedContext as CONTEXT
}

export async function isAlreadyDeployed(context: PublishContext, state: State): Promise<boolean> {
  if (state.pluginConfig.is_it_deployed) {
    const packageName = state.pluginConfig.is_it_deployed.package_name
    const version = context.nextRelease.version
    const packageManager = state.pluginConfig.is_it_deployed.package_manager

    context.logger.log(`Checking if version ${version} of package ${packageName} is already deployed to ${packageManager}.`)

    const isItDeployedCheck = await isItDeployed.isItDeployed({ 
      packageManager: packageManager as any, // cast to any because this wants an enum string, but we just have a string. let is-it-deployed throw an error during deployment if the package manager is invalid.
      packageName: packageName, 
      packageVersion: version
    })

    if (isItDeployedCheck) return true 
  }     
  
  if (state.pluginConfig.should_skip_cmd) {
    // Using same logic as https://github.com/semantic-release/exec/blob/master/lib/exec.js to do string formatting so the syntax is similar for both plugins. 
    const preCheckCommand = stringFormat(state.pluginConfig.should_skip_cmd)(context)  

    context.logger.log(`Will run precheck command: '${preCheckCommand}' - If command returns true (0 exit code), the deployment will be skipped.`)
      
    try {
      context.logger.log(`Running command. Output of command will be displayed below....`)
      await runCommand(preCheckCommand, prepareLoggerForDeploymentPlugin(context, state))            

      return true  // exit 0 is is it deployed         
    } catch (e) {}
  } 

  return false // the default return result 
}  