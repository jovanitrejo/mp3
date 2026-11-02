export class BadQueryError extends Error { };

export function parseJSONQueryParam(value: unknown, name: string): any {
    if (value === undefined) return undefined;
    let parsed: any;
    try {
        parsed = JSON.parse(value as string);
    } catch {
        throw new BadQueryError(`Invalid JSON in ${name} parameter`); 
    }
    if ((name === "skip" || name === "limit") && (!Number.isInteger(parsed) || parsed < 0)) {
        throw new BadQueryError(`${name} must be a nonnegative integer`);
    }
    return parsed;
}

export default parseJSONQueryParam;