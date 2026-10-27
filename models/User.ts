import mongoose from "mongoose";
import userSchema from "../schemas/User.ts";
export default mongoose.model('User', userSchema);