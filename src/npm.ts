import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";

// Note: Must run jest tests with `NODE_OPTIONS=--experimental-vm-modules` to allow esm modules to be imported since some semantic-release plugins are esm only
export async function getDeploymentPlugin(name: string): Promise<SemanticReleasePlugin | undefined> {
  try {
    let plugin = await import(name)
    return plugin
  } catch (e) {
    return undefined
  }
}