export function parseEnv(text: string): Record<string, string>;
export function loadEnv(): (key: string) => string;
export function applyEnvFile(dir?: string, target?: Record<string, string | undefined>): string[];
