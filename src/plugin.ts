import { FailContext, VerifyReleaseContext, VerifyConditionsContext, AnalyzeCommitsContext, GenerateNotesContext, PrepareContext, PublishContext, AddChannelContext, SuccessContext, BaseContext } from "semantic-release"
import { PluginConfig, parse } from "./type/pluginConfig";
import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";
import * as steps from './util'
import * as npm from './npm'

export interface State {
  deploymentPlugin: SemanticReleasePlugin
  skipDeployment: boolean
  pluginConfig: PluginConfig
}

// State of the plugin.
export let state: State // exporting for tests to modify it
resetState()

export function resetState() { // useful for running tests 
  state = {
    deploymentPlugin: {},
    skipDeployment: false,
    pluginConfig: {} as PluginConfig
  }
}

// -- Plugin lifecycle functions 

export async function verifyConditions(rawPluginConfig: any, context: VerifyConditionsContext) {
  const parsedPluginConfig = parse(rawPluginConfig)
  if (parsedPluginConfig instanceof Error) {
    throw parsedPluginConfig
  }
  state.pluginConfig = parsedPluginConfig

  // This is the first function that semantic-release calls on a plugin. 
  // Check if the deployment plugin is already installed. If not, we must throw an error because we cannot install it for them. 
  // I have tried to do that, but it seems that node loads all modules at startup so it cannot find a module after it's installed during runtime. 
  let alreadyInstalledPlugin = await npm.getDeploymentPlugin(state.pluginConfig.deploy_plugin.name)
  if (!alreadyInstalledPlugin) {
    throw new Error(`Deployment plugin, ${state.pluginConfig.deploy_plugin.name}, doesn't seem to be installed. Install it with \`npm install ${state.pluginConfig.deploy_plugin.name}\` and then try running your deployment again.`)
  }

  state.deploymentPlugin = alreadyInstalledPlugin

  if (state.deploymentPlugin.verifyConditions) {    
    context.logger.log(`Running verifyConditions for deployment plugin: ${state.pluginConfig.deploy_plugin.name}`)

    await state.deploymentPlugin.verifyConditions(state.pluginConfig.deploy_plugin.config || {}, steps.prepareLoggerForDeploymentPlugin(context, state))
  }  
}

export async function analyzeCommits(_: any, context: AnalyzeCommitsContext) {  
  if (state.deploymentPlugin.analyzeCommits) {  
    context.logger.log(`Running analyzeCommits for deployment plugin: ${state.pluginConfig.deploy_plugin.name}`)
  
    await state.deploymentPlugin.analyzeCommits(state.pluginConfig.deploy_plugin.config || {}, steps.prepareLoggerForDeploymentPlugin(context, state))
  }
}

export async function verifyRelease(_: any, context: VerifyReleaseContext) {
  if (state.deploymentPlugin.verifyRelease) {
    context.logger.log(`Running verifyRelease for deployment plugin: ${state.pluginConfig.deploy_plugin.name}`)

    await state.deploymentPlugin.verifyRelease(state.pluginConfig.deploy_plugin.config || {}, steps.prepareLoggerForDeploymentPlugin(context, state))
  }
}

export async function generateNotes(_: any, context: VerifyReleaseContext) {
  if (state.deploymentPlugin.generateNotes) {
    context.logger.log(`Running generateNotes for deployment plugin: ${state.pluginConfig.deploy_plugin.name}`)

    await state.deploymentPlugin.generateNotes(state.pluginConfig.deploy_plugin.config || {}, steps.prepareLoggerForDeploymentPlugin(context, state))
  }
}

export async function prepare(_: any, context: PrepareContext) {
  if (state.deploymentPlugin.prepare) {
    context.logger.log(`Running prepare for deployment plugin: ${state.pluginConfig.deploy_plugin.name}`)

    await state.deploymentPlugin.prepare(state.pluginConfig.deploy_plugin.config || {}, steps.prepareLoggerForDeploymentPlugin(context, state))
  }
}

export async function publish(_: any, context: PublishContext) {     
  const isPublished = await steps.isAlreadyDeployed(context, state)
  state.skipDeployment = isPublished
  
  if (state.skipDeployment) {
    context.logger.log(`The plugin: ${state.pluginConfig.deploy_plugin.name} will be skipped for version ${context.nextRelease.version}.`)
    return 
  } else {
    context.logger.log(`The plugin: ${state.pluginConfig.deploy_plugin.name} will continue to run as normal.`)
  }

  if (state.deploymentPlugin.publish) {
    context.logger.log(`Running publish for deployment plugin: ${state.pluginConfig.deploy_plugin.name}`)
    await state.deploymentPlugin.publish(state.pluginConfig.deploy_plugin.config || {}, steps.prepareLoggerForDeploymentPlugin(context, state))
  } 
  
  if (state.pluginConfig.check_after_publish) {
    const didPublishSuccessfully = await steps.isAlreadyDeployed(context, state)

    if (!didPublishSuccessfully) {      
      // throw error so that semantic-release knows to stop execution.
      throw new Error(`Publish plugin, ${state.pluginConfig.deploy_plugin.name}, successfully ran. But after checking ${state.pluginConfig.is_it_deployed?.package_manager}, the version ${context.nextRelease.version} was not found. Therefore, the publish plugin may have not executed successfully.`)
    }
  }
}

export async function addChannel(_: any, context: AddChannelContext) {
  if (state.skipDeployment) {
    context.logger.log(`Skipping addChannel for deploy plugin ${state.pluginConfig.deploy_plugin.name} because publish was skipped.`)
    return
  }

  if (state.deploymentPlugin.addChannel) {
    context.logger.log(`Running addChannel for deployment plugin: ${state.pluginConfig.deploy_plugin.name}`)
    await state.deploymentPlugin.addChannel(state.pluginConfig.deploy_plugin.config || {}, steps.prepareLoggerForDeploymentPlugin(context, state))
  }  
}

export async function success(_: any, context: SuccessContext) {
  if (state.skipDeployment) {
    context.logger.log(`Skipping success for deploy plugin ${state.pluginConfig.deploy_plugin.name} because publish was skipped.`)
    return
  }

  if (state.deploymentPlugin.success) {
    context.logger.log(`Running success for deployment plugin: ${state.pluginConfig.deploy_plugin.name}`)
    await state.deploymentPlugin.success(state.pluginConfig.deploy_plugin.config || {}, steps.prepareLoggerForDeploymentPlugin(context, state))
  }
}

export async function fail(_: any, context: FailContext) {  
  if (state.skipDeployment) {
    context.logger.log(`Skipping fail for deploy plugin ${state.pluginConfig.deploy_plugin.name} because publish was skipped.`)
    return
  }

  if (state.deploymentPlugin.fail) {
    context.logger.log(`Running fail for deployment plugin: ${state.pluginConfig.deploy_plugin.name}`)
    await state.deploymentPlugin.fail(state.pluginConfig.deploy_plugin.config || {}, steps.prepareLoggerForDeploymentPlugin(context, state))
  }
}
