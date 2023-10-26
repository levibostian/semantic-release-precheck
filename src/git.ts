import { runCommand } from "./exec"
import { BaseContext } from "semantic-release"

export async function deleteTag(tagName: string, context: BaseContext): Promise<void> {
  let command = `git push origin --delete ${tagName}`

  context.logger.log(`Running git command: \`${command}\``)

  await runCommand(command, context)  
}