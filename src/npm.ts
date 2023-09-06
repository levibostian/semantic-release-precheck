import { SemanticReleasePlugin } from "./type/semanticReleasePlugin";

export function getDeploymentPlugin(name: string): SemanticReleasePlugin | undefined {
  try {
    return require(name)
  } catch (e) {
    return undefined
  }
}

export async function install(name: string) {
  const { exec } = require("child_process")
  const { promisify } = require("util")
  const execAsync = promisify(exec)
  await execAsync(`npm install --no-save ${name}`)
}