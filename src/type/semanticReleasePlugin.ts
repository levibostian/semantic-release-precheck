import { FailContext, VerifyReleaseContext, VerifyConditionsContext, AnalyzeCommitsContext, GenerateNotesContext, PrepareContext, PublishContext, AddChannelContext, SuccessContext } from "semantic-release"

export interface SemanticReleasePlugin {
  verifyConditions?: (pluginConfig: Object, context: VerifyConditionsContext) => Promise<void>
  analyzeCommits?: (pluginConfig: Object, context: AnalyzeCommitsContext) => Promise<void>
  verifyRelease?: (pluginConfig: Object, context: VerifyReleaseContext) => Promise<void>
  generateNotes?: (pluginConfig: Object, context: GenerateNotesContext) => Promise<void>
  prepare?: (pluginConfig: Object, context: PrepareContext) => Promise<void>
  publish?: (pluginConfig: Object, context: PublishContext) => Promise<void>
  addChannel?: (pluginConfig: Object, context: AddChannelContext) => Promise<void>
  success?: (pluginConfig: Object, context: SuccessContext) => Promise<void>
  fail?: (pluginConfig: Object, context: FailContext) => Promise<void>
}