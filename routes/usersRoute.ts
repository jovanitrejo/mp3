import express, { type Request, type Response, type Router } from 'express';
import mongoose from 'mongoose';
import UserSchema from '../schemas/User.ts';

const User = mongoose.model('User', UserSchema);

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    const allUsers = await User.find({});
    res.json({
        message: "Okay!",
        data: allUsers
    });
})

export default router;