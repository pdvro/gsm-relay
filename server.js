require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const path = require('path');
const https = require('https'); // Added for SSL bypass
const app = express();
const PORT = process.env.PORT || 3000;

const httpsAgent = new https.Agent({ rejectUnauthorized: false }); // Added for SSL bypass

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-secret-key',
    resave: false,
    saveUninitialized: true
}));

// --- Configuration ---
const PREDEFINED_TOKEN = process.env.PREDEFINED_TOKEN;

const devices = [];
let i = 1;
while (process.env[`TELTONIKA_URL_${i}`]) {
    if (process.env[`TELTONIKA_USERNAME_${i}`] && process.env[`TELTONIKA_PASSWORD_${i}`]) {
        let deviceUrl = process.env[`TELTONIKA_URL_${i}`];
        if (!deviceUrl.startsWith('http://') && !deviceUrl.startsWith('https://')) {
            deviceUrl = `https://${deviceUrl}`; // Default to https if no protocol
        }
        devices.push({
            url: deviceUrl,
            username: process.env[`TELTONIKA_USERNAME_${i}`],
            password: process.env[`TELTONIKA_PASSWORD_${i}`],
            token: null, // To store the authentication token
            tokenExpiry: null // To store the token expiry time
        });
    }
    i++;
}

if (devices.length === 0) {
    console.error("FATAL: No devices configured. Please set TELTONIKA_URL_1, TELTONIKA_USERNAME_1, and TELTONIKA_PASSWORD_1 environment variables.");
    process.exit(1); // Exit if no devices are configured
}

const SEND_DELAY_MS = 3000; // 3-second delay between sends 

// --- In-memory Queue ---
const smsQueue = [];
const smsLog = [];
let currentDeviceIndex = 0;
let isProcessing = false;

// --- App Locals ---
app.locals.smsLog = smsLog;
app.locals.smsQueue = smsQueue;
app.locals.isProcessing = isProcessing;
app.locals.processQueue = processQueue;

// --- Authentication ---
async function getAuthToken(device) {
    // Always get a new token
    try {
        const response = await axios.post(`${device.url}/api/login`, {
            username: device.username,
            password: device.password
        }, { httpsAgent }); 

        if (response.data && response.data.success === true && response.data.data && response.data.data.token) {
            device.token = response.data.data.token; // Access token from response.data.data.token
            return device.token;
        } else {
            console.error(`Auth token request failed for device ${device.url}. Response data:`, response.data);
            return null;
        }
    } catch (error) {
        console.error(`Error getting auth token for device ${device.url}:`, error); // Log full error object
        return null;
    }
}


// --- Queue Processing Logic ---
async function processQueue() {
    app.locals.isProcessing = true;

    while (app.locals.smsQueue.length > 0) {
        const device = devices[currentDeviceIndex];
        const sms = app.locals.smsQueue.shift(); // Get the next message
        const { to, message } = sms;
        sms.retryCount = sms.retryCount || 0;

        try {
            const token = await getAuthToken(device);
            if (!token) {
                throw new Error('Could not get auth token');
            }

            // Using POST method for Teltonika firmware 7+
            const teltonikaUrl = `${device.url}/api/messages/actions/send`; 
            const requestData = {
                data: {
                    number: to,
                    message: message, 
                    modem: "1-1" 
                }
            };
            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                httpsAgent 
            };

            console.log(`Sending SMS to ${to} via device ${currentDeviceIndex + 1} (retry ${sms.retryCount})`);
            const response = await axios.post(teltonikaUrl, requestData, config);
            console.log(`Teltonika response from device ${currentDeviceIndex + 1}:`, response.data);
            app.locals.smsLog.push({
                timestamp: new Date().toISOString(),
                to,
                message,
                status: 'Sent',
                response: response.data,
                device: currentDeviceIndex + 1
            });

        } catch (error) {
            console.error(`Error sending SMS via device ${currentDeviceIndex + 1}:`, error.message);
            app.locals.smsLog.push({
                timestamp: new Date().toISOString(),
                to,
                message,
                status: `Error (retry ${sms.retryCount})`,
                response: error.message,
                device: currentDeviceIndex + 1
            });

            if (sms.retryCount < 3) {
                sms.retryCount++;
                app.locals.smsQueue.unshift(sms); // Add back to the front of the queue
                console.log(`Retrying SMS to ${to}. Retry count: ${sms.retryCount}`);
            } else {
                console.error(`Failed to send SMS to ${to} after 3 retries. Discarding message.`);
            }
        }

        // Move to the next device for the next message
        currentDeviceIndex = (currentDeviceIndex + 1) % devices.length;

        // Wait for the specified delay before sending the next message
        if (app.locals.smsQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
        }
    }

    app.locals.isProcessing = false;
    console.log('Queue is empty. Waiting for new messages.');
}

// --- Routes ---
const indexRoutes = require('./routes/index');
const smsRoutes = require('./routes/sms');

app.use('/', indexRoutes);
app.use('/', smsRoutes);


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // Start processing any messages that might be in the queue on startup
    if (app.locals.smsQueue.length > 0) {
        processQueue();
    }
});
