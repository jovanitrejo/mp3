import Task from '../models/Task.ts';
import express, { type Request, type Response, type NextFunction } from 'express';
import parseJSONQueryParam, { BadQueryError } from '../utils/parseJSONQueryParam.ts';
import mongoose from 'mongoose';
import { HttpError } from '../utils/HttpError.ts';
import User from '../models/User.ts';

const router = express.Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const where = parseJSONQueryParam(req.query.where, 'where');
        const sort = parseJSONQueryParam(req.query.sort, 'sort');
        const select = parseJSONQueryParam(req.query.select, 'select');
        const skip = parseJSONQueryParam(req.query.skip, 'skip');
        const limit = parseJSONQueryParam(req.query.limit, 'limit');
        const count = parseJSONQueryParam(req.query.count, 'count');

        if (count) return res.status(200).json({ message: "OK", data: await Task.countDocuments(where) })

        const query = Task.find({});
        if (where) query.where(where);
        if (sort) query.sort(sort);
        if (select) query.select(select);
        if (skip) query.skip(skip);
        if (limit) query.limit(limit); else query.limit(100);

        return res.json({
            message: "Okay!",
            data: await query.exec()
        })
    } catch (error: unknown) {
        if (error instanceof BadQueryError) {
            return res.status(400).json({
                message: "There was an error parsing your query",
                data: {}
            });
        } else if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({
                message: "One of the parameters has the wrong type",
                data: {}
            });
        }
        return next(error);
    }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const id: string | string[] = req.params.id;
    try {
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json(
                {
                    message: "Not a valid _id value",
                    data: {}
                }
            )
        }

        const select = parseJSONQueryParam(req.query.select, 'select');

        const query = Task.findById(id);
        if (select) query.select(select);
        const task = await query.exec();

        if (!task) {
            return res.status(404).json({
                message: "Task not found",
                data: {}
            })
        }
        return res.status(200).json({
            message: "OK",
            data: task
        });
    } catch (error: unknown) {
        if (error instanceof BadQueryError) {
            return res.status(400).json({
                message: "There was an error parsing your query",
                data: {}
            });
        } else if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({
                message: "One of the parameters has the wrong type",
                data: {}
            });
        }
        return next(error);
    }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, description, deadline, completed, assignedUser, assignedUserName } = req.body ?? {};
        if (typeof name !== 'string' || (description !== undefined && typeof description !== 'string')) {
            throw new HttpError(400, "name and description must be strings");
        }
        const task = new Task({ name, description, deadline, completed, assignedUserName });
        await task.validate();

        if (assignedUser !== undefined && assignedUser !== "") {
            if (!mongoose.isObjectIdOrHexString(assignedUser)) throw new HttpError(400, "assignedUser is not a valid user id");
            const user = await User.findById(assignedUser);
            if (!user) throw new HttpError(404, 'Unable to find user to assign this task to');
            if (assignedUserName !== undefined && user.name !== task.assignedUserName) throw new HttpError(400, "assignedUserName does not match the assigned user's name");
            task.assignedUser = user._id.toString();
            task.assignedUserName = user.name;
        } else {
            if (assignedUserName !== undefined && assignedUserName !== "unassigned") {
                throw new HttpError(400, "assignedUserName requires a matching assignedUser");
            }
            task.assignedUser = "";
            task.assignedUserName = "unassigned";
        }

        await task.save();
        if (task.assignedUser && !task.completed) {
            await User.updateOne({_id: task.assignedUser}, {$addToSet: {pendingTasks: task._id.toString() }})
        }

        return res.status(201).json({
            message: "Okay",
            data: task
        });

    } catch (error: unknown) {
        if (error instanceof HttpError) {
            return res.status(error.status).json({
                message: error.message,
                data: {}
            })
        } else if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({
                message: "Make sure that the deadline and name are valid",
                data: {}
            });
        } else if (error instanceof SyntaxError) {
            return res.status(400).json({
                message: "The JSON body is deformed",
                data: {}
            });
        } else {
            return next(error);
        }
    }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id;

        // URL id is checked first, including ids that aren't valid IDs in MongoDB
        if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "Task not found");
        const task = await Task.findById(id);
        if (!task) throw new HttpError(404, "Task not found");

        // Remember the previous state so tasks can be synced after saving
        const oldUser = task.assignedUser;

        // Replace the task with the request body
        const { name, description, deadline, completed, assignedUser, assignedUserName } = req.body ?? {};
        if (typeof name !== 'string' || (description !== undefined && typeof description !== 'string')) {
            throw new HttpError(400, "name and description must be strings");
        }
        task.set({
            name, description, deadline, completed: completed ?? false, assignedUserName
        });
        await task.validate();

        if (assignedUser !== undefined && assignedUser !== "") {
            if (!mongoose.isObjectIdOrHexString(assignedUser)) throw new HttpError(400, "assignedUser is not a valid user id");
            const user = await User.findById(assignedUser);
            if (!user) throw new HttpError(404, 'Unable to find user to assign this task to');
            if (assignedUserName !== undefined && user.name !== task.assignedUserName) throw new HttpError(400, "assignedUserName does not match the assigned user's name");
            task.assignedUser = user._id.toString();
            task.assignedUserName = user.name;
        } else {
            if (assignedUserName !== undefined && assignedUserName !== "unassigned") {
                throw new HttpError(400, "assignedUserName requires a matching assignedUser");
            }
            task.assignedUser = "";
            task.assignedUserName = "unassigned";
        }

        await task.save();
        const taskId = task._id.toString();
        const newUser = task.assignedUser;

        if (oldUser && oldUser !== newUser) {
            await User.updateOne({ _id: oldUser }, {$pull: {pendingTasks: taskId}});
        }

        if (newUser) {
            await User.updateOne(
                { _id: newUser },
                task.completed ? { $pull: {pendingTasks: taskId} } : { $addToSet: {pendingTasks: taskId} }
            )
        }

        return res.status(200).json({
            message: "Task updated",
            data: task
        });
    } catch (error: unknown) {
        if (error instanceof HttpError) {
            return res.status(error.status).json({
                message: error.message,
                data: {}
            });
        } else if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({
                message: "Make sure that the name and deadline are valid",
                data: {}
            });
        } else {
            return next(error);
        }
    }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id;
        if (!mongoose.isObjectIdOrHexString(id)) throw new HttpError(404, "Task not found");
        const task = await Task.findById(id);
        if (!task) throw new HttpError(404, "Task not found");

        if (task.assignedUser) {
            await User.updateOne(
                { _id: task.assignedUser },
                { $pull: { pendingTasks: task._id.toString() } }
            );
        }
        await task.deleteOne();
        return res.status(200).json({
            message: "Task deleted",
            data: task
        });
    } catch (error: unknown) {
        if (error instanceof HttpError) {
            return res.status(error.status).json({
                message: error.message,
                data: {}
            });
        }
        return next(error);
    }
});

export default router;