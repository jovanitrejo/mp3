import mongoose, { mongo } from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema({
    name: String,
    email: String,
    pendingTasks: String, // The `_id` fields of the *pending* tasks that this user has
    dateCreated: Date
})