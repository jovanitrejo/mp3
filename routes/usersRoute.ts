import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import mongoose from 'mongoose';
import parseJSONQueryParam, { BadQueryError } from '../utils/parseJSONQueryParam.ts';

const User = mongoose.model('User', UserSchema);

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

export default router;