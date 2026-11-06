export function checkAccess(
  env?: NodeJS.ProcessEnv,
  request?: typeof fetch,
): Promise<void>;
export function smokeDeploy(
  env?: NodeJS.ProcessEnv,
  request?: typeof fetch,
): Promise<void>;
