import { FailContext, VerifyReleaseContext, VerifyConditionsContext, AnalyzeCommitsContext, GenerateNotesContext, PrepareContext, PublishContext, AddChannelContext, SuccessContext, BaseContext } from "semantic-release"
import { PluginConfig, parse } from "./type/pluginConfig";
import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";
import { runCommand } from "./exec";
import stringFormat from 'lodash.template';
import * as isItDeployed from 'is-it-deployed'
import * as steps from './steps'

// State of the plugin.
let state: {
  deploymentPlugin: SemanticReleasePlugin
  skipDeployment: boolean
  pluginConfig: PluginConfig 
} 
resetState()

export function resetState() { // useful for running tests 
  state = {
    deploymentPlugin: {},
    skipDeployment: false,
    pluginConfig: undefined
  }
}

// semantic-release uses a lib called signale for logging. This lib helps semantic-release make logs better by telling you what plugin is executing. 
// Because this plugin's job is to execute another plugin, we want to do the same thing that semantic-release does to show when the deploy plugin is executing. 
// We should see logs such as: 
// [semantic-release] [semantic-release-precheck] Running verifyConditions for deployment plugin: @semantic-release/npm
// [semantic-release] [@semantic-release/npm] running publish step here. 
// Depending on what plugin is running, our precheck plugin or the deploy plugin. 
// 
// This function modifies the context object with the modified logger so we can send the modified context to the deploy plugin.
export function prepareLoggerForDeploymentPlugin<CONTEXT>(context: BaseContext, pluginConfig: PluginConfig): CONTEXT {
  let logger = context.logger 

  // the logic for how to modify the logger is from: https://github.com/semantic-release/semantic-release/blob/e759493e074650748fc3bbef9e640db413b52d56/lib/plugins/normalize.js#L40
  if (logger.scope && logger.scope instanceof Function) { // check if the logger has a scope function before calling it to try to be compatible if semantic-release ever changes the lib they use for logging 
    // we need to get the existing scopes, convert it to an array, add the name of the plugin, then use that to modify the existing logger. 
    let existingScopes: string[] | string = (logger as any).scopeName
    if (typeof existingScopes === "string") {
      existingScopes = [existingScopes]
    }
    existingScopes.push(pluginConfig.deploy_plugin.name)

    logger = logger.scope(...existingScopes)
  }

  // We want to return a new object so we don't modify the original context object. Our own plugin still uses the original context object.
  // return a new one that is only passed to the deploy plugin.
  let modifiedContext = Object.assign({}, context)
  modifiedContext.logger = logger

  return modifiedContext as CONTEXT
}

// -- Plugin lifecycle functions 

export async function verifyConditions(rawPluginConfig: any, context: VerifyConditionsContext) {
  const result = await steps.verifyConditions(rawPluginConfig, context)

  state.pluginConfig = result.pluginConfig
  state.deploymentPlugin = result.deploymentPlugin
}

export async function analyzeCommits(_: any, context: AnalyzeCommitsContext) {  
  if (state.deploymentPlugin.analyzeCommits) {  
    context.logger.log(`Running analyzeCommits for deployment plugin: ${state.pluginConfig.deploy_plugin.name}`)

    await state.deploymentPlugin.analyzeCommits(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}

export async function verifyRelease(_: any, context: VerifyReleaseContext) {
  if (deploymentPlugin.verifyRelease) {
    context.logger.log(`Running verifyRelease for deployment plugin: ${pluginConfig.deploy_plugin.name}`)

    await deploymentPlugin.verifyRelease(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}

export async function generateNotes(rawPluginConfig: any, context: VerifyReleaseContext) {
  if (deploymentPlugin.generateNotes) {
    context.logger.log(`Running generateNotes for deployment plugin: ${pluginConfig.deploy_plugin.name}`)

    await deploymentPlugin.generateNotes(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}

export async function prepare(rawPluginConfig: any, context: PrepareContext) {
  if (deploymentPlugin.prepare) {
    context.logger.log(`Running prepare for deployment plugin: ${pluginConfig.deploy_plugin.name}`)

    await deploymentPlugin.prepare(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}

export async function publish(rawPluginConfig: any, context: PublishContext) {  
  const checkIfDeployed = async(): Promise<boolean> => {
    if (pluginConfig.is_it_deployed) {
      const packageName = pluginConfig.is_it_deployed.package_name
      const version = context.nextRelease.version
      const packageManager = pluginConfig.is_it_deployed.package_manager
  
      context.logger.log(`Checking if version ${version} of package ${packageName} is already deployed to ${packageManager}.`)
  
      const isItDeployedCheck = await isItDeployed.isItDeployed({ 
        packageManager: packageManager as any, // cast to any because this wants an enum string, but we just have a string. let is-it-deployed throw an error during deployment if the package manager is invalid.
        packageName: packageName, 
        packageVersion: version
      })

      if (isItDeployedCheck) return true 
    }     
    
    if (pluginConfig.should_skip_cmd) {
      // Using same logic as https://github.com/semantic-release/exec/blob/master/lib/exec.js to do string formatting so the syntax is similar for both plugins. 
      const preCheckCommand = stringFormat(pluginConfig.should_skip_cmd)(context)  
  
      context.logger.log(`Will run precheck command: '${preCheckCommand}' - If command returns true (0 exit code), the deployment will be skipped.`)
        
      try {
        context.logger.log(`Running command. Output of command will be displayed below....`)
        await runCommand(preCheckCommand, prepareLoggerForDeploymentPlugin(context, pluginConfig))            

        return true  // exit 0 is is it deployed         
      } catch (e) {}
    } 

    return false // the default return result 
  }  
 
  const isPublished = await checkIfDeployed()
  skipDeployment = isPublished

  if (skipDeployment) {
    context.logger.log(`Will skip publish and future plugin functions for deploy plugin because version ${context.nextRelease.version} is already deployed.`)      
    return 
  }

  if (deploymentPlugin.publish) {
    context.logger.log(`Running publish for deployment plugin: ${pluginConfig.deploy_plugin.name}`)
    await deploymentPlugin.publish(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  } 
        
  if (pluginConfig.check_if_deployed_after_publish) {
    const didPublishSuccessfully = await checkIfDeployed()    

    if (!didPublishSuccessfully) {      
      // throw error so that semantic-release knows to stop execution.
      throw new Error(`Publish plugin, ${pluginConfig.deploy_plugin.name}, successfully ran. But after checking ${pluginConfig.is_it_deployed?.package_manager}, the version ${context.nextRelease.version} was not found. Therefore, the publish plugin may have not executed successfully.`)
    }
  }
}

export async function addChannel(rawPluginConfig: any, context: AddChannelContext) {
  if (skipDeployment) {
    context.logger.log(`Skipping addChannel for deploy plugin ${pluginConfig.deploy_plugin.name} because publish was skipped.`)
    return
  }

  if (deploymentPlugin.addChannel) {
    context.logger.log(`Running addChannel for deployment plugin: ${pluginConfig.deploy_plugin.name}`)
    await deploymentPlugin.addChannel(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }  
}

export async function success(rawPluginConfig: any, context: SuccessContext) {
  if (skipDeployment) {
    context.logger.log(`Skipping success for deploy plugin ${pluginConfig.deploy_plugin.name} because publish was skipped.`)
    return
  }

  if (deploymentPlugin.success) {
    context.logger.log(`Running success for deployment plugin: ${pluginConfig.deploy_plugin.name}`)
    await deploymentPlugin.success(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}

export async function fail(rawPluginConfig: any, context: FailContext) {  
  if (skipDeployment) {
    context.logger.log(`Skipping fail for deploy plugin ${pluginConfig.deploy_plugin.name} because publish was skipped.`)
    return
  }

  if (deploymentPlugin.fail) {
    context.logger.log(`Running fail for deployment plugin: ${pluginConfig.deploy_plugin.name}`)
    await deploymentPlugin.fail(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}
