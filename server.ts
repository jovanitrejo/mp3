import 'dotenv/config';
import express, { Router, type Request, type Response, type NextFunction } from "express";
import mongoose from 'mongoose';
import routes from './routes/index.ts';

const router: Router = express.Router();

// Create our Express application
var app = express();

// Use environment defined port or 3000
var port = process.env.PORT || 3000;

const MONGODBURI = process.env.MONGODB_URI;
if (!MONGODBURI) throw new Error('The connection string for MongoDB is not set!');

// Connect to a MongoDB --> Uncomment this once you have a connection string!!
mongoose.connect(MONGODBURI).catch(function (err) { console.error('MongoDB connection error:', err.message); });

// Allow CORS so that backend and frontend could be put on different servers
var allowCrossDomain = function (req: Request, res: Response, next: NextFunction) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
    next();
};
app.use(allowCrossDomain);

// Parse URL-encoded and JSON request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Use routes as a module (see index.js)
routes(app, router);

// Define global error handling middleware:
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    res.status(500).json({
        message: "An internal error occurred",
        data: {}
    })
});

// Start the server
app.listen(port);
console.log('Server running on port ' + port);
