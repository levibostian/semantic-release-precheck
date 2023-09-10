import { FailContext, VerifyReleaseContext, VerifyConditionsContext, AnalyzeCommitsContext, GenerateNotesContext, PrepareContext, PublishContext, AddChannelContext, SuccessContext } from "semantic-release"
import { PluginConfig } from "./type/pluginConfig";
import * as npm from "./npm";
import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";
import { runCommand } from "./exec";
import stringFormat from 'lodash.template';

let deploymentPlugin: SemanticReleasePlugin 
let skipDeployment = false

export function resetPlugin() { // useful for running tests 
  deploymentPlugin = {}
  skipDeployment = false
}

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
    await deploymentPlugin.verifyConditions(pluginConfig.deploy_plugin.config || {}, context)
  }
}

export async function analyzeCommits(pluginConfig: PluginConfig, context: AnalyzeCommitsContext) {  
  if (deploymentPlugin.analyzeCommits) {  
    await deploymentPlugin.analyzeCommits(pluginConfig.deploy_plugin.config || {}, context)
  }
}

export async function verifyRelease(pluginConfig: PluginConfig, context: VerifyReleaseContext) {
  if (deploymentPlugin.verifyRelease) {
    await deploymentPlugin.verifyRelease(pluginConfig.deploy_plugin.config || {}, context)
  }
}

export async function generateNotes(pluginConfig: PluginConfig, context: VerifyReleaseContext) {
  if (deploymentPlugin.generateNotes) {
    await deploymentPlugin.generateNotes(pluginConfig.deploy_plugin.config || {}, context)
  }
}

export async function prepare(pluginConfig: PluginConfig, context: PrepareContext) {
  if (deploymentPlugin.prepare) {
    await deploymentPlugin.prepare(pluginConfig.deploy_plugin.config || {}, context)
  }
}

export async function publish(pluginConfig: PluginConfig, context: PublishContext) {
  // Using same logic as https://github.com/semantic-release/exec/blob/master/lib/exec.js to do string formatting so the syntax is similar for both plugins. 
  const preCheckCommand = stringFormat(pluginConfig.precheck_command)(context)

  context.logger.log(`Running precheck command before publishing: ${preCheckCommand}`)
  context.logger.log(`If command returns a non-0 exit code or the command throws an exception because there is a problem with the command, the deployment will be skipped.`)  
  
  try {
    await runCommand(preCheckCommand, context)
  } catch (e) {
    skipDeployment = true
  }

  if (skipDeployment) {
    context.logger.log(`Will skip deployment because precheck command returned a non-0 exit code.`)
    return
  }

  if (deploymentPlugin.publish) {
    await deploymentPlugin.publish(pluginConfig.deploy_plugin.config || {}, context)
  }
}

export async function addChannel(pluginConfig: PluginConfig, context: AddChannelContext) {
  if (skipDeployment) {
    context.logger.log(`skipping deploy plugin addChannel because deployment was skipped.`)
    return
  }

  if (deploymentPlugin.addChannel) {
    await deploymentPlugin.addChannel(pluginConfig.deploy_plugin.config || {}, context)
  }  
}

export async function success(pluginConfig: PluginConfig, context: SuccessContext) {
  if (skipDeployment) {
    context.logger.log(`skipping deploy plugin success because deployment was skipped.`)
    return
  }

  if (deploymentPlugin.success) {
    await deploymentPlugin.success(pluginConfig.deploy_plugin.config || {}, context)
  }  
}

export async function fail(pluginConfig: PluginConfig, context: FailContext) {  
  if (skipDeployment) {
    context.logger.log(`skipping deploy plugin fail because deployment was skipped.`)
    return
  }

  if (deploymentPlugin.fail) {
    await deploymentPlugin.fail(pluginConfig.deploy_plugin.config || {}, context)
  }
}
