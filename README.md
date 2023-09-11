# semantic-release-precheck

[semantic-release](https://github.com/semantic-release/semantic-release) plugin to perform a pre-check for an existing deployment before attempting a new deployment. To helps prevent the scenario where a deployment is retried after previous failure and deployment gets stuck in a retry loop, never to succeed. 

Many services that you deploy to (npmjs, Maven Central, Cocoapods) do not allow you to overwrite a version once you have pushed it already. This behavior can add complexity to your automated deployment process where a deployment may fail (indefinitely) when you retry it. 

This plugin tries to avoid that scenario where it will skip a deployment if a particular version has already been deployed before. 

# Getting started 

* Install the plugin: `npm install semantic-release-precheck`

* Add the plugin to your workflow. The plugin configuration will change depending on what type of project you are deploying. 

Let's use an example of deploying a node module to npmjs: 

```json
{
    "tagFormat": "${version}",
    "branches": [
        "main"
    ],
    "plugins": [
        "@semantic-release/commit-analyzer",
        "@semantic-release/release-notes-generator",
        ["semantic-release-precheck", {
            "shoud_skip_deployment_cmd": "npm view name-of-project@${nextRelease.version}",
            "deploy_plugin": {
                "name": "@semantic-release/npm",
                "config": {
                    "pkgRoot": "dist/"
                }
            }             
        }]
    ]
}
```

Let's break this configuration down. 

* `shoud_skip_deployment_cmd` is a command that executes to check if the version has already been deployed. If command fails, this indicates that the version has previously been deployed and a new deployment should be skipped. 

* `deploy_plugin` is used to define an existing sematic-release plugin that should be used to perform the deployment, if a deployment is to occur. This allows you to conveniently re-use existing plugins in the semantic-release community. 

It's important that whatever plugin that you use for deployment gets moved out of the `plugins` array and instead goes inside of `semantic-release-precheck` object. As an example, **this is an invalid configuration:**

```json
{
    "plugins": [
        "@semantic-release/npm",
        ["semantic-release-precheck", {
            "deploy_plugin": {
                "name": "@semantic-release/npm"
            }
        }]
    ]
}
```

It's invalid because `@semantic-release/npm` exists *both* inside of `semantic-release-precheck` and outside of it. 

*Note:* You must have the deployment plugin installed with npm before running your deployment. 

There is an `config` object inside of `deploy_plugin`. This object will be provided to the `deploy_plugin` during execution. This means that any option that the `deploy_plugin` supports can go into this object. 

# Why is this plugin needed? 

A deployment processes can involve multiple steps. This means there are multiple places where a deployment failure can occur. It is ideal that after a deployment failure, you can simply retry the deployment again. This *should* work, but many services that you may deploy code to (npmjs, Maven Central, Cocoapods) do not allow uploading the same version to them multiple times. This could result in this scenario (that has happened to me many times): 

* semantic-release determines the next version to release of your software is `1.0.1`. 
* Using `@semantic-release/npm`, `1.0.1` is successfully uploaded to npm. 
* Oh, no! A step later on in the deployment process failed (pushing a git tag may fail, for example). Your deployment process has failed. 
* You fix permissions to allow a git tag to be pushed successfully this time. You retry making the `1.0.1` deployment to make it successful this time. 
* When `@semantic-release/npm` attempts to push `1.0.1`, it will fail because npm notices that `1.0.1` has been deployed before. You're deployment process is now stuck where it may never succeed because we cannot get past `@semantic-release/npm` succeeding anymore. 

That is where this plugin comes in. By checking if a version already exists, we skip a new deployment attempt which allows the remainder of your deployment workflow to continue. Ultimately, getting the retried deployment to a successful state. 

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
2. Existing semantic-release configurations should be able to adopt this plugin. This is the main reason for adding `deploy_plugin.config` as an option to the plugin, so this plugin can be compatible with deployment modules and their options. 
3. This plugin's purpose is to avoid a failed deployment that could occur during deployment when pushing a version. There may be other use cases you can think of for a check to run before a deployment is done, but that may not meet the purpose of this plugin. You may instead be looking for another plugin such as [`exec`](https://github.com/semantic-release/exec). 

