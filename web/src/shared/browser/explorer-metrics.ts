declare global {
  interface Window {
    enableMapDiagnostics?: boolean;
  }
}

export function diagnosticsEnabled() {
  return typeof window !== "undefined" && window.enableMapDiagnostics === true;
}

export const metrics = {
  ready: 0,
  taps: [] as number[],
  errors: [] as string[],
};
