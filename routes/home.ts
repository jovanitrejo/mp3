import {type Router} from 'express';

export default function (router: Router) {

    var homeRoute = router.route('/');

    homeRoute.get(function (req, res) {
        const connectionString = process.env.TOKEN;
        res.json({ message: 'My connection string is ' + connectionString });
    });

    return router;
}
