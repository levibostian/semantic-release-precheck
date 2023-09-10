import { execSync } from 'child_process';
import { BaseContext } from "semantic-release"

export async function runCommand(command: string, context: BaseContext): Promise<undefined> {
  try {
    let stdout = execSync(command)
    context.logger.log(`output: ${stdout.toString()}`)
  } catch (error: any) {
    context.logger.error(error.stderr ? error.stderr.toString() : error.message)
    throw error
  }
}