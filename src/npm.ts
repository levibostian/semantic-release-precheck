import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";

export async function getDeploymentPlugin(name: string): Promise<SemanticReleasePlugin | undefined> {
  try {
    let plugin = await import(name)
    return plugin
  } catch (e) {
    return undefined
  }
}