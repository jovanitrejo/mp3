import Task from "../models/Task.ts";
import { HttpError } from "./HttpError.ts";
import mongoose from "mongoose";

// Validates the format of pendingTasks in the request body, treating a missing pendingTasks as an empty list. Removes duplicate IDs.
export function parsePendingTaskIds(pendingTasks: unknown): string[] {
    if (pendingTasks === undefined) return [];
    if (!Array.isArray(pendingTasks)) throw new HttpError(400, "pendingTasks must be a list of task ids");
    for (const id of pendingTasks) {
        if (!mongoose.isObjectIdOrHexString(id)) throw new HttpError(400, `"${id}" is not a valid task id`);
    }
    return [...new Set(pendingTasks.map(String))]
}

// Function asserting that all pending tasks are in fact marked "pending" and that on the database, the length is the same upon check.
export async function checkPendingTasks(ids: string[]) {
    const tasks = await Task.find({_id: { $in: ids }});
    if (tasks.length !== ids.length) throw new HttpError(404, "One or more tasks in pendingTasks do not exist");
    if (tasks.some(task => task.completed)) throw new HttpError(400, "pendingTasks cannot contain a completed tasks");
    return tasks;
}