import mongoose from 'mongoose';
const { Schema } = mongoose;

const taskSchema = new Schema({
    name: String,
    description: String,
    deadline: {
        type: Date,
        required: true
    },
    completed: Boolean,
    assignedUser: {
        type: String, // _id of the user this task is assigned to
        default: ""
    },
    assignedUserName: {
        type: String,
        default: "unassigned"
    },
    dateCreated: {
        type: Date,
        default: Date.now,
    }
});

export default taskSchema;