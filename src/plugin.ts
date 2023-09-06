import { FailContext, VerifyReleaseContext, VerifyConditionsContext, AnalyzeCommitsContext, GenerateNotesContext, PrepareContext, PublishContext, AddChannelContext, SuccessContext } from "semantic-release"
import { PluginConfig } from "./type/pluginConfig";

export async function verifyConditions(pluginConfig: PluginConfig, context: VerifyConditionsContext & {options: {dryRun: boolean}}) {
  (await import(pluginConfig.name)).verifyConditions(pluginConfig.options, context)  
}

export async function analyzeCommits(pluginConfig: PluginConfig, context: AnalyzeCommitsContext) {  
  (await import(pluginConfig.name)).verifyConditions(pluginConfig.options, context) 
}

export async function verifyRelease(pluginConfig: PluginConfig, context: VerifyReleaseContext) {
  (await import(pluginConfig.name)).verifyConditions(pluginConfig.options, context) 
}

export async function generateNotes(pluginConfig: PluginConfig, context: VerifyReleaseContext) {
  (await import(pluginConfig.name)).generateNotes(pluginConfig.options, context) 
}

export async function prepare(pluginConfig: PluginConfig, context: PrepareContext) {
  (await import(pluginConfig.name)).prepare(pluginConfig.options, context) 
}

export async function publish(pluginConfig: PluginConfig, context: PublishContext) {
  (await import(pluginConfig.name)).publish(pluginConfig.options, context) 
}

export async function addChannel(pluginConfig: PluginConfig, context: AddChannelContext) {
  (await import(pluginConfig.name)).addChannel(pluginConfig.options, context) 
}

export async function success(pluginConfig: PluginConfig, context: SuccessContext) {
  (await import(pluginConfig.name)).success(pluginConfig.options, context) 
}

export async function fail(pluginConfig: PluginConfig, context: FailContext) {
  (await import(pluginConfig.name)).fail(pluginConfig.options, context) 
}