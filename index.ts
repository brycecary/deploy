import { exec as execCallback } from "child_process";
import * as webhook from "discord-webhook-node";
import * as ExpressJS from "express";
import * as fs from "fs/promises";
import * as Path from "path";
import { DeploymentConfig, GitHubHookRequest } from "types/types";
import * as util from "util";
import Config from "./config";
import verifySignature from "./util/verifySignature";

const exec = util.promisify(execCallback);

const app = ExpressJS();
const port = 3090;

app.use(ExpressJS.json());

app.post("/webhook/:service", async (req: ExpressJS.Request, res: ExpressJS.Response) => {
    // Only accept push events
    if (req.header("X-GitHub-Event") != "push") {
        console.log(`[${req.params.service}] Didn't deploy, not a push event`);
        return res.status(200).send("Didn't deploy, not a push event");
    }

    // Find the service in the config file
    const service = Config.find((c) => c.name.toLowerCase() == req.params.service.toLowerCase());

    // If the service exists, continue
    if (!service) {
        // If the service doesn't exist, return a 404
        console.log(`Unknown service ${req.params.service}`);
        return res.status(404).send(`Unknown service ${req.params.service}`);
    }

    // Verify the signature
    if (!verifySignature(req, service.auth_token)) {
        // If the signature doesn't match, return a 403
        console.log(`[${service.name}] Didn't deploy, signature didn't match`);
        return res.status(403).send("Didn't deploy, signature didn't match");
    }

    // Read the deploy config
    const file = await fs.readFile(Path.join(service.mount_location, service.deploy_config_override ?? "deploy.json"), "utf-8");
    const oldDeployConfig = JSON.parse(file) as DeploymentConfig;

    // Grab body, and type it
    const body = req.body as GitHubHookRequest;

    // If the branch doesn't match, return a 200, but don't deploy
    if (body.ref != service.ref) {
        console.log(`[${service.name}] Didn't deploy, branch didn't match`);
        return res.status(200).send("Didn't deploy, branch didn't match");
    }

    // Move into deploy phase after passing checks
    console.log(`[${service.name}] Deploying ${body.head_commit.id} - ${body.head_commit.message}`);
    res.status(200).send("Deploying");

    // Create a webhook if one is specified
    let hook: webhook.Webhook | undefined;
    if (service.webhook || oldDeployConfig.webhook) {
        hook = new webhook.Webhook(service.webhook ?? oldDeployConfig.webhook);
        hook.info(`${service.name} - Starting Deploy`, `Deployment Info`, `Trigger: GitHub Webhook\nCommit: ${body.head_commit.id}\nMessage: ${body.head_commit.message}\nAuthor: ${body.head_commit.author.name} <${body.head_commit.author.email}>`);
    }

    // Log start time
    const startTime = new Date();

    // Run pre pull commands
    if (oldDeployConfig.prePull) {
        try {
            const { stdout, stderr } = await exec(`cd ${service.mount_location} && ${oldDeployConfig.prePull.join(" && ")}`);
        } catch (error) {
            // If the pre pull commands fail, quit
            console.log(`[${service.name}] Pre Pull Error: ${error}`);
            if (hook) hook.error(`${service.name} - Pre Pull Error`, `Error while running pre pull commands`, `Error: ${error}`);
            return;
        }
    }

    // Pull the repo
    try {
        const { stdout, stderr } = await exec(`cd ${service.mount_location} && git reset --hard && git pull`);
    } catch (error) {
        console.log(`[${service.name}] Pull Error: ${error}`);
        if (hook) hook.error(`${service.name} - Pull Error`, `Error while pulling`, `Error: ${error}`);
        return;
    }

    // Read the new deploy config
    // const file1 = await fs.readFile(Path.join(service.mount_location, service.deploy_config_override ?? "deploy.json"), "utf-8");
    // const newDeployConfig = JSON.parse(file1) as DeploymentConfig;

    // Run post pull commands
    if (oldDeployConfig.postPull) {
        try {
            const { stdout, stderr } = await exec(`cd ${service.mount_location} && ${oldDeployConfig.postPull.join(" && ")}`);
        } catch (error) {
            // If the post pull commands fail, quit
            console.log(`[${service.name}] Post Pull Error: ${error}`);
            if (hook) hook.error(`${service.name} - Post Pull Error`, `Error while running post pull commands`, `Error: ${error}`);
            return;
        }
    }

    // Log completion
    console.log(`[${service.name}] Deployed ${body.head_commit.id} - ${body.head_commit.message}`);
    if (hook) hook.success(`${service.name} - Deployed`, `Deployment Info`, `Trigger: GitHub Webhook\nCommit: ${body.head_commit.id}\nMessage: ${body.head_commit.message}\nAuthor: ${body.head_commit.author.name} <${body.head_commit.author.email}>\nTime: ${new Date().getTime() - startTime.getTime()}ms`);
});

app.listen(port, () => {
    console.log(`Started on port ${port}`);

    // Log registered services
    console.log(Config.length > 0 ? `Registered Services:` : `No services registered`);
    Config.forEach((service) => {
        console.log(` - ${service.name}`);
    });
});
