const express = require('express');
const router = express.Router();

// Middleware to check if the user is logged in
const checkLogin = (req, res, next) => {
    if (req.session.loggedin) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Login page
router.get('/login', (req, res) => {
    res.render('login');
});

// Handle login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.loggedin = true;
        res.redirect('/');
    } else {
        res.send('Incorrect Username and/or Password!');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Dashboard
router.get('/', checkLogin, (req, res) => {
    const sortedSmsLog = [...req.app.locals.smsLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.render('dashboard', { smsLog: sortedSmsLog });
});

// Clear SMS Log
router.get('/clear-log', checkLogin, (req, res) => {
    req.app.locals.smsLog.length = 0; // Clear the array
    res.redirect('/');
});

module.exports = router;
