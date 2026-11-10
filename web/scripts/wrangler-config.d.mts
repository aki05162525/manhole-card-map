type Config = Record<string, unknown> & {
  d1_databases?: { binding: string }[];
};
export function readConfig(config: string): Config;
export function previewConfig(config: Config): Config;
export function writePreviewConfig(source: string, out: string): Promise<void>;
export function d1Bindings(config: Config): string[];
export function apiHealth(config: Config): "enabled" | "disabled";
