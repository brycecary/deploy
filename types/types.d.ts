export interface ServiceConfig {
    name: string;
    auth_token: string;
    ref: string;
    mount_location: string;
    deploy_config_override?: string;
    webhook?: string;
}

export interface DeploymentConfig {
    isPM2?: boolean;
    isDocker?: boolean;
    isDockerCompose?: boolean;
    prePull?: string[];
    postPull?: string[];
    webhook?: string;
}

export interface Author {
    email: string;
    name: string;
}

export interface Commit {
    added: string[];
    id: string;
    message: string;
    author: Author;
}

export interface Pusher {
    name: string;
}

export interface GitHubHookRequest {
    after: string;
    base_ref: string;
    before: string;
    commits: Commit[];
    compare: string;
    created: boolean;
    deleted: boolean;
    forced: boolean;
    head_commit: Commit;
    pusher: Pusher;
    ref: string;
}
