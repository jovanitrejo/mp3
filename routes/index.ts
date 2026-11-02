/*
 * Connect all of your endpoints together here.
 */
import homeRoute from './home.ts';
import usersRoute from './usersRoute.ts';
import tasksRoute from './tasksRoute.ts';
import {type Express, type Router} from 'express';

export default function (app: Express, router: Router): void {
    app.use('/api', homeRoute(router));
    app.use('/api/users', usersRoute);
    app.use('/api/tasks', tasksRoute);
};
