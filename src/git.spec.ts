import * as exec from "./exec"
import { BaseContext } from 'semantic-release';
import * as git from "./git"
import { Signale } from 'signale'

let context: BaseContext = {  
  logger: {
    log: (message: string) => {
      console.log(message)
    }      
  } as Signale,
  stderr: process.stderr,
  stdout: process.stdout
}

describe('deleteTag', () => {
  it('should generate expected git command string', async () => {
    const exectedCommand = 'git push origin --delete v1.0.0'

    jest.spyOn(exec, 'runCommand').mockReturnValue(Promise.resolve(undefined))

    await git.deleteTag("v1.0.0", context)

    expect(exec.runCommand).toHaveBeenCalledWith(exectedCommand, context)
  });
})