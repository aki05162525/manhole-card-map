export function checkAccess(
  env?: NodeJS.ProcessEnv,
  request?: typeof fetch,
): Promise<void>;
export function smokeDeploy(
  env?: NodeJS.ProcessEnv,
  request?: typeof fetch,
): Promise<void>;
export function retrying<T>(
  check: () => Promise<T>,
  options?: {
    attempts?: number;
    delay?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<T>;
