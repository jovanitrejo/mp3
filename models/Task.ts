import mongoose from "mongoose";
import taskSchema from "../schemas/Task.ts";
export default mongoose.model('Task', taskSchema);