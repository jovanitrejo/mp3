import mongoose from "mongoose";
const { Schema } = mongoose;

export const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    pendingTasks: [String], // The `_id` fields of the *pending* tasks that this user has
    dateCreated: {
        type: Date,
        default: Date.now
    }
})

export default userSchema;