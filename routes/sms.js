const express = require('express');
const router = express.Router();

// Middleware to check for a valid token
const checkToken = (req, res, next) => {
    console.log('--- New request ---');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

    let token = req.headers.authorization;
    if (token && token.startsWith('Bearer ')) {
        // Remove Bearer from string
        token = token.slice(7, token.length);
    }

    if (token && token === process.env.PREDEFINED_TOKEN) {
        return next();
    }

    if (req.body.token && req.body.token === process.env.PREDEFINED_TOKEN) {
        return next();
    }

    console.log('Invalid token received.');
    res.status(403).send('Forbidden: Invalid token');
};

// Middleware to check if the user is logged in
const checkLogin = (req, res, next) => {
    if (req.session.loggedin) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Handle SMS requests
router.post('/sms', checkToken, (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).send('Missing "to" or "message" in request body');
    }

    const smsQueue = req.app.locals.smsQueue;
    smsQueue.push({ to, message });
    console.log(`Queue size: ${smsQueue.length}`);
    
    // Start processing if not already running
    if (!req.app.locals.isProcessing) {
        req.app.locals.processQueue();
    }

    res.status(202).send('SMS queued successfully');
});

// Handle test SMS requests
router.post('/test-sms', checkLogin, (req, res) => {
    const testMessage = {
        to: 'yourtestnumber',
        message: 'yourtestmessage'
    };
    const smsQueue = req.app.locals.smsQueue;
    smsQueue.push(testMessage);
    console.log(`Queue size: ${smsQueue.length}`);
    
    if (!req.app.locals.isProcessing) {
        req.app.locals.processQueue();
    }

    res.redirect('/');
});

module.exports = router;
