import { FailContext, VerifyReleaseContext, VerifyConditionsContext, AnalyzeCommitsContext, GenerateNotesContext, PrepareContext, PublishContext, AddChannelContext, SuccessContext, BaseContext } from "semantic-release"
import { PluginConfig } from "./type/pluginConfig";
import * as npm from "./npm";
import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";
import { runCommand } from "./exec";
import stringFormat from 'lodash.template';

// global variables used by the whole plugin as it goes through semantic-release lifecycle
let deploymentPlugin: SemanticReleasePlugin 
let skipDeployment = false

export function resetPlugin() { // useful for running tests 
  deploymentPlugin = {}
  skipDeployment = false
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

  context.logger = logger 

  return context as CONTEXT
}

// -- Plugin lifecycle functions 

export async function verifyConditions(pluginConfig: PluginConfig, context: VerifyConditionsContext) {
  // This is the first function that semantic-release calls on a plugin. 
  // Check if the deployment plugin is already installed. If not, we must throw an error because we cannot install it for them. 
  // I have tried to do that, but it seems that node loads all modules at startup so it cannot find a module after it's installed during runtime. 
  let alreadyInstalledPlugin = await npm.getDeploymentPlugin(pluginConfig.deploy_plugin.name)
  if (!alreadyInstalledPlugin) {
    throw new Error(`Deployment plugin, ${pluginConfig.deploy_plugin.name}, doesn't seem to be installed. Install it with \`npm install ${pluginConfig.deploy_plugin.name}\` and then try running your deployment again.`)
  }

  deploymentPlugin = alreadyInstalledPlugin

  if (deploymentPlugin.verifyConditions) {    
    context.logger.log(`Running verifyConditions for deployment plugin: ${pluginConfig.deploy_plugin.name}`)

    await deploymentPlugin.verifyConditions(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}

export async function analyzeCommits(pluginConfig: PluginConfig, context: AnalyzeCommitsContext) {  
  if (deploymentPlugin.analyzeCommits) {  
    context.logger.log(`Running analyzeCommits for deployment plugin: ${pluginConfig.deploy_plugin.name}`)

    await deploymentPlugin.analyzeCommits(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}

export async function verifyRelease(pluginConfig: PluginConfig, context: VerifyReleaseContext) {
  if (deploymentPlugin.verifyRelease) {
    context.logger.log(`Running verifyRelease for deployment plugin: ${pluginConfig.deploy_plugin.name}`)

    await deploymentPlugin.verifyRelease(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}

export async function generateNotes(pluginConfig: PluginConfig, context: VerifyReleaseContext) {
  if (deploymentPlugin.generateNotes) {
    context.logger.log(`Running generateNotes for deployment plugin: ${pluginConfig.deploy_plugin.name}`)

    await deploymentPlugin.generateNotes(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}

export async function prepare(pluginConfig: PluginConfig, context: PrepareContext) {
  if (deploymentPlugin.prepare) {
    context.logger.log(`Running prepare for deployment plugin: ${pluginConfig.deploy_plugin.name}`)

    await deploymentPlugin.prepare(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}

export async function publish(pluginConfig: PluginConfig, context: PublishContext) {
  // Using same logic as https://github.com/semantic-release/exec/blob/master/lib/exec.js to do string formatting so the syntax is similar for both plugins. 
  const preCheckCommand = stringFormat(pluginConfig.should_skip_deployment_cmd)(context)  

  context.logger.log(`Will run precheck command: '${preCheckCommand}' - If command returns true (0 exit code), the deployment will be skipped.`)
  
  skipDeployment = true  
  try {
    context.logger.log(`Running command. Output of command will be displayed below....`)  
    await runCommand(preCheckCommand, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  } catch (e) {
    skipDeployment = false
  }

  if (skipDeployment) {
    context.logger.log(`Will skip publish and future plugin functions for deploy plugin because precheck command returned a non-0 exit code.`)
    return
  }

  if (deploymentPlugin.publish) {
    context.logger.log(`Running publish for deployment plugin: ${pluginConfig.deploy_plugin.name}`)

    await deploymentPlugin.publish(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}

export async function addChannel(pluginConfig: PluginConfig, context: AddChannelContext) {
  if (skipDeployment) {
    context.logger.log(`Skipping addChannel for deploy plugin ${pluginConfig.deploy_plugin.name} because publish was skipped.`)
    return
  }

  if (deploymentPlugin.addChannel) {
    context.logger.log(`Running addChannel for deployment plugin: ${pluginConfig.deploy_plugin.name}`)
    await deploymentPlugin.addChannel(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }  
}

export async function success(pluginConfig: PluginConfig, context: SuccessContext) {
  if (skipDeployment) {
    context.logger.log(`Skipping success for deploy plugin ${pluginConfig.deploy_plugin.name} because publish was skipped.`)
    return
  }

  if (deploymentPlugin.success) {
    context.logger.log(`Running success for deployment plugin: ${pluginConfig.deploy_plugin.name}`)
    await deploymentPlugin.success(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}

export async function fail(pluginConfig: PluginConfig, context: FailContext) {  
  if (skipDeployment) {
    context.logger.log(`Skipping fail for deploy plugin ${pluginConfig.deploy_plugin.name} because publish was skipped.`)
    return
  }

  if (deploymentPlugin.fail) {
    context.logger.log(`Running fail for deployment plugin: ${pluginConfig.deploy_plugin.name}`)
    await deploymentPlugin.fail(pluginConfig.deploy_plugin.config || {}, prepareLoggerForDeploymentPlugin(context, pluginConfig))
  }
}
