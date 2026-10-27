export function parseJSONQueryParam(value: unknown, name: string): any {
    if (value === undefined) return undefined;
    try { return JSON.parse(value as string); } catch { throw new BadQueryError(`Invalid JSON in "${name}" parameter`)}
}

export class BadQueryError extends Error {};

export default parseJSONQueryParam;