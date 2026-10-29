import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import mongoose from 'mongoose';
import parseJSONQueryParam, { BadQueryError } from '../utils/parseJSONQueryParam.ts';
import User from '../models/User.ts';
import Task from '../models/Task.ts';
import { checkPendingTasks, parsePendingTaskIds } from '../utils/pendingTasks.ts';
import { HttpError } from '../utils/HttpError.ts';

const router = express.Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {   
    try {
        const where = parseJSONQueryParam(req.query.where, 'where');
        const sort = parseJSONQueryParam(req.query.sort, 'sort');
        const select = parseJSONQueryParam(req.query.select, 'select');
        const skip = parseJSONQueryParam(req.query.skip, 'skip');
        const limit = parseJSONQueryParam(req.query.limit, 'limit');
        const count = parseJSONQueryParam(req.query.count, 'count');

        if (count) return res.status(200).json({ message: "OK", data: await User.countDocuments(where)})

        const query = User.find({});
        if (where) query.where(where);
        if (sort) query.sort(sort);
        if (select) query.select(select);
        if (skip) query.skip(skip);
        if (limit) query.limit(limit);
    
        return res.json({
            message: "Okay!",
            data: await query.exec()
        })
    } catch (error: unknown) {
        if (error instanceof BadQueryError) {
            return res.status(400).json({
                message: "There was an error parsing your query",
                data: error.message
            });
        } else if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({
                message: "One of the parameters has the wrong type",
                data: error.message
            });
        }
        return next(error);
    }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const id: string | string[] = req.params.id;
    try {
        const select = parseJSONQueryParam(req.query.select, 'select');

        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json(
                {
                    message: "Not a valid _id value",
                    data: {}
                }
            )
        }

        const query = User.findById(id);
        if (select) query.select(select);
        const user = await query.exec();

        if (!user) {
            return res.status(404).json({
                message: "User not found",
                data: {}
            })
        }
        return res.status(200).json({
            message: "OK",
            data: user
        });
    } catch (error: unknown) {
        if (error instanceof BadQueryError) {
            return res.status(400).json({
                message: "There was an error parsing your query",
                data: error.message
            });
        } else if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({
                message: "One of the parameters has the wrong type",
                data: error.message
            });
        }
        return next(error);
    }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, pendingTasks } = req.body ?? {};
        const taskIds = parsePendingTaskIds(pendingTasks);
        const newUser = new User({ name, email, pendingTasks: taskIds });
        await newUser.validate();
        if (await User.exists({email})) {
            throw new HttpError(400, "A user with that email already exists");
        }

        // validate taskIds from body
        await checkPendingTasks(taskIds);

        // Do server save validation check
        await newUser.save();
        // Upon success
        if (taskIds.length > 0) {
            // Removes any tasks in the pendingList from other users (if they exist for other users, since the new user owns them)
            await User.updateMany(
                {_id: { $ne: newUser._id }, pendingTasks: {$in: taskIds}},
                { $pull: {pendingTasks: {$in: taskIds}}}
            );
            // Assign tasks to new user in the database.
            await Task.updateMany(
                { _id: {$in: taskIds}},
                { assignedUser: newUser._id.toString(), assignedUserName: newUser.name}
            )
        }
        return res.status(201).json({
            message: "User created",
            data: newUser
        });
    } catch (error: unknown) {
        if (error instanceof HttpError) {
            return res.status(error.status).json({
                message: error.message,
                data: {}
            })
        } else if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({
                message: "Make sure that the email and name are valid",
                data: {}
            });
        } else if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
            return res.status(400).json({
                message: "A user with that email already exists",
                data: {}
            })
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
        if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "User not found");
        const user = await User.findById(id);
        if (!user) throw new HttpError(404, "User not found");

        // Remember the previous state so tasks can be synced after saving
        const oldName = user.name;
        const oldTaskIds = [...user.pendingTasks];

        // Replace the user with the request body
        const { name, email, pendingTasks } = req.body ?? {};
        const taskIds = parsePendingTaskIds(pendingTasks);
        user.set({ name, email, pendingTasks: taskIds });
        await user.validate();
        if (await User.exists({ email, _id: { $ne: user._id } })) {
            throw new HttpError(400, "A user with that email already exists");
        }

        // validate taskIds
        await checkPendingTasks(taskIds);

        await user.save();
        const userId = user._id.toString();

        // Tasks from pendingTasks become unassigned
        const removedTaskIds = oldTaskIds.filter(taskId => !taskIds.includes(taskId));
        if (removedTaskIds.length > 0) {
            await Task.updateMany(
                { _id: { $in: removedTaskIds }, assignedUser: userId },
                { assignedUser: "", assignedUserName: "unassigned" }
            );
        }
        if (taskIds.length > 0) {
            // Removes any tasks in the pendingList from other users
            await User.updateMany(
                { _id: { $ne: user._id }, pendingTasks: { $in: taskIds } },
                { $pull: { pendingTasks: { $in: taskIds } } }
            );
            // Assign tasks to this user in the database.
            await Task.updateMany(
                { _id: { $in: taskIds } },
                { assignedUser: userId, assignedUserName: user.name }
            );
        }
        // A name change applies to every task still assigned to this user
        if (user.name !== oldName) {
            await Task.updateMany({ assignedUser: userId }, { assignedUserName: user.name });
        }

        return res.status(200).json({
            message: "User updated",
            data: user
        });
    } catch (error: unknown) {
        if (error instanceof HttpError) {
            return res.status(error.status).json({
                message: error.message,
                data: {}
            });
        } else if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({
                message: "Make sure that the email and name are valid",
                data: {}
            });
        } else if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
            return res.status(400).json({
                message: "A user with that email already exists",
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
        if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "User not found");
        const user = await User.findById(id);
        if (!user) throw new HttpError(404, "User not found");

        // Unassign ALL tasks belonging to deleted user
        await Task.updateMany(
            { assignedUser: user._id.toString() },
            { assignedUser: "", assignedUserName: "unassigned"}
        );
        await user.deleteOne();

        return res.status(200).json({
            message: "User deleted",
            data: user
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