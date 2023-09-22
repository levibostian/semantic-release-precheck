import { execSync } from 'child_process';
import { BaseContext } from "semantic-release"

export async function runCommand(command: string, context: BaseContext): Promise<undefined> {
  try {
    let stdout = execSync(command)
    context.logger.log(stdout.toString())
  } catch (error: any) {
    let stdout = error.stdout.toString()
    if (stdout) context.logger.log(stdout) 

    let stderr = error.stderr.toString()
    if (stderr) context.logger.error(stderr) 
    
    throw error
  }
}