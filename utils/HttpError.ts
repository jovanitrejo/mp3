/**
 * Used for when parsing through task list for a user
 * Particularly used in error handling, the status code is passed on for res to return
 */
export class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}