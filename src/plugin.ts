import { FailContext, VerifyReleaseContext, VerifyConditionsContext, AnalyzeCommitsContext, GenerateNotesContext, PrepareContext, PublishContext, AddChannelContext, SuccessContext } from "semantic-release"
import { PluginConfig } from "./type/pluginConfig";
import * as npm from "./npm";
import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";

let deploymentPlugin: SemanticReleasePlugin

export async function verifyConditions(pluginConfig: PluginConfig, context: VerifyConditionsContext) {  
  // This is the first function that semantic-release calls on a plugin. 
  // Check if the deployment plugin is already installed. If not, we must throw an error because we cannot install it for them. 
  // I have tried to do that, but it seems that node loads all modules at startup so it cannot find a module after it's installed during runtime. 
  let alreadyInstalledPlugin = await npm.getDeploymentPlugin(pluginConfig.name)
  if (!alreadyInstalledPlugin) {
    throw new Error(`Deployment plugin, ${pluginConfig.name}, doesn't seem to be installed. Install it with \`npm install ${pluginConfig.name}\` and then try running your deployment again.`)
  }

  deploymentPlugin = alreadyInstalledPlugin

  if (deploymentPlugin.verifyConditions) {
    await deploymentPlugin.verifyConditions(pluginConfig.options || {}, context)
  }
}

export async function analyzeCommits(pluginConfig: PluginConfig, context: AnalyzeCommitsContext) {  
  if (deploymentPlugin.analyzeCommits) {  
    await deploymentPlugin.analyzeCommits(pluginConfig.options || {}, context)
  }
}

export async function verifyRelease(pluginConfig: PluginConfig, context: VerifyReleaseContext) {
  if (deploymentPlugin.verifyRelease) {
    await deploymentPlugin.verifyRelease(pluginConfig.options || {}, context)
  }
}

export async function generateNotes(pluginConfig: PluginConfig, context: VerifyReleaseContext) {
  if (deploymentPlugin.generateNotes) {
    await deploymentPlugin.generateNotes(pluginConfig.options || {}, context)
  }
}

export async function prepare(pluginConfig: PluginConfig, context: PrepareContext) {
  if (deploymentPlugin.prepare) {
    await deploymentPlugin.prepare(pluginConfig.options || {}, context)
  }
}

export async function publish(pluginConfig: PluginConfig, context: PublishContext) {
  if (deploymentPlugin.publish) {
    await deploymentPlugin.publish(pluginConfig.options || {}, context)
  }
}

export async function addChannel(pluginConfig: PluginConfig, context: AddChannelContext) {
  if (deploymentPlugin.addChannel) {
    await deploymentPlugin.addChannel(pluginConfig.options || {}, context)
  }  
}

export async function success(pluginConfig: PluginConfig, context: SuccessContext) {
  if (deploymentPlugin.success) {
    await deploymentPlugin.success(pluginConfig.options || {}, context)
  }  
}

export async function fail(pluginConfig: PluginConfig, context: FailContext) {
  if (deploymentPlugin.fail) {
    await deploymentPlugin.fail(pluginConfig.options || {}, context)
  }
}
