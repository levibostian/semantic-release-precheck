# semantic-release-precheck

[semantic-release](https://github.com/semantic-release/semantic-release) plugin that skips publishing if version deployed has already been deployed. Great plugin to assert that a deployment was successful. Or, allowing you to [retry a previously failed deployment](#why-is-this-plugin-needed). 

# Getting started 

* Install the plugin: `npm install semantic-release-precheck`

* Add the plugin to your workflow. The plugin configuration will change depending on what type of project you are deploying. 

Let's use an example of deploying a node module to npmjs: 

```json
{
    "plugins": [
        ["semantic-release-precheck", {
            "is_it_deployed": {
                "package_manager": "npm",
                "package_name": "name-of-package",
            },
            "deploy_plugin":
                ["@semantic-release/npm", {
                    "pkgRoot": "dist/"
                }]
        }]
    ]
}
```

Let's break this configuration down. 

### Options

| Options      | Description                | Default      |
| ------------ | -------------------------- | ------------ |
| `is_it_deployed` | Uses the tool [is-it-deployed](https://github.com/levibostian/is-it-deployed/) to check if that version of the package has been deployed already. Check if [your package manager](https://github.com/levibostian/is-it-deployed/?tab=readme-ov-file#supported-package-managers) is currently supported by the module and see examples for what values to use for it. If not, use `should_skip_cmd`. | null |
| `should_skip_cmd` | A bash command to execute. If command runs successfully (exit code 0), then `publish` step of `deploy_plugin` will be skipped. | null |
| `check_after_publish` | After `deploy_plugin` `publish` step gets executed, run  will run `is_it_deployed` and `should_skip_cmd` again. Enable this feature if you want to be extra confident that the deployment was successful to the server. | `true` |
| `deploy_plugin` | Defines an existing sematic-release plugin that you want `precheck` to execute for you. It's suggested that if you configure `is_it_deployed` to `package_manager = npm`, for example, then the `deploy_plugin` should deploy a npm module to a npm server. | null | 

> *Reminder:* Install the deploy plugin before running semantic-release. 

# Why is this plugin needed? 

A deployment processes can involve multiple steps. This means there are multiple places where a deployment failure can occur. It would be ideal if you could simply retry running semantic-release after it fails. This *should* work, but many services that you may deploy code to (npmjs, Maven Central, Cocoapods) do not allow uploading the same version multiple times. If you were to retry running semantic-release after a failed deploy, this scenario could occur for you: 

* semantic-release determines the next version to release of your software is `1.0.1`. 
* Using `@semantic-release/npm`, `1.0.1` is successfully uploaded to npm. 
* Oh, no! A step later on in the deployment process failed. semantic-release exits early. 
* You fix the problem. Then, retry running semantic-release to successfully finish the `1.0.1` deployment that failed previously. 
* During this retry, when `@semantic-release/npm` attempts to push version `1.0.1`, it fails because npm's server rejects uploading `1.0.1` again. You're deployment process is now stuck in an infinite loop because we cannot get past the `@semantic-release/npm` step. 

That is where this plugin comes in. By checking if a version already exists, we can skip steps that do not need to run which allows the remainder of your semantic-release steps to continue. Ultimately, getting the retried deployment to a successful state! 

> Tip: Another great plugin to consider to make deployment retries easy is [`semantic-release-recovery`](https://github.com/levibostian/semantic-release-recovery). 

### Assumptions made by plugin 

This plugin does make some assumptions it goes by. 

1. All deployments are immutable. If, for example, you deploy `1.0.1` and you realize you made a mistake and introduced a bug in that version, you need to make a new deployment of `1.0.2`. Once you attempt a deployment, you cannot delete that deployment. 

This assumption should be easy to follow because it's the rule that many services follow and why this plugin exists in the first place. 

2. When a deployment executes successfully from start to finish, all that you care about is that version `1.0.1` exists for customers to download. Let's say that the first time that you tried deploying `1.0.1`, it successfully uploaded to npm, but another step after failed. So, you retry the `1.0.1` deployment again and this time the deployment was successful all the way to the end. However, during this 2nd attempt, uploading to npm was skipped because `1.0.1` already existed. This plugin assumes that you do not care that during the successful deployment an upload was skipped. All that you care about is that *eventually, all of the deployment steps succeed at least once*. 

# Development 

```
$ nvm use 
$ npm install 
$ npm run test 
```

### Vision for this project

This project's vision is led by fundamental goals that this plugin is trying to accomplish. With all future development, we try to follow these goals.

1. The plugin allows you to re-use existing semantic-release plugins for deployments. This plugin is not trying to replace existing plugins, but add extra functionality to each of them. By leveraging existing plugins, we reduce the amount of work required to improve our deployments. 
2. Existing semantic-release configurations should be able to adopt this plugin. No need for plugin authors to adopt this workflow, but instead allow anyone who runs `semantic-release` to use it if they choose. 
3. This plugin's purpose is to provide a more powerful `publish` step for `semantic-release`. We try to keep this plugin focused and not bloated with features. If you have an idea you want to contribute back to this project, it's suggested to open an issue pitching the idea first. 

