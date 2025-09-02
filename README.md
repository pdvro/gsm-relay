
# On-Premise Teltonika GSM Gateway for Traccar SMS Notifications

This guide provides instructions for setting up an **on-premise Teltonika GSM gateway** for use with **Traccar SMS notifications**.

---

## Requirements

**Supported Devices:**
- **Tested:** Teltonika LTE Routers (RUT 360 and above)
- **Untested:** Teltonika Gateways (TRB 140 and above)

---

## Guide

### Step 1: Project Files
1. Create a project folder and download the required files.
2. Run the following command to install dependencies:
   ```bash
   npm install
   ```
3. Access the application at `localhost:3000` or `YourIP:3000`.

---

### Step 2: Configure the Routers or Gateways (Guide for RUT 360)
1. **Connect to the Router:**
   - Access the router at `192.168.1.1` using the credentials provided on the back of the device.

2. **Change the Admin Password:**
   - Update the default admin password (mandatory for security).

3. **Configure WAN IP:**
   - Navigate to **Network > WAN** and set the WAN IP to a static address within your subnet.
     - Example: If your PC/server is `192.168.0.2`, set the router address to `192.168.0.10`.

4. **Enable Remote Access:**
   - Go to **System > Administration > Access Control** and enable remote access for both HTTP and HTTPS.

5. **Disable SIM Card Lock:**
   - Navigate to **Network > Mobile > Utilities** and disable the SIM card lock.

6. **Disable VoLTE:**
   - Go to **Network > Mobile > Connection** and disable VoLTE.

---

### Step 3: Test (Optional but Recommended for Debugging)

Teltonika firmware 7+ requires an authentication token for API access. Use the following commands to test the router:

1. **Generate an Authentication Token:**
   Replace `192.168.1.1` with the IP from **Step 2**. 
   ```bash
   curl -X POST "https://192.168.1.1/api/login" \
        -H "Content-Type: application/json" \
        -d '{"username": "admin", "password": "password"}' \
        -k
   ```
   **Expected Response:**
   ```json
   {"success":true,"data":{"username":"admin","token":"8602c790738d288baab907c9f991721d","expires":299}}
   ```
   *(Note: The token expires in 5 minutes. Regenerate it if needed.)*

2. **Check Device Status:**
   Replace `<IP>` and `<SESSION_TOKEN>` with your router's IP and the token generated above.
   ```bash
   curl -X GET "https://<IP>/api/system/device/status" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer <SESSION_TOKEN>" \
        -k
   ```
   **Expected Response:**
   Look for `"id": "1-1"`, `"3-1"`, or similar. You will need this modem ID later.
   ```json
   {
     "success": true,
     "data": {
       "board": {
         "modems": [
           {
             "id": "1-1",
             ...
           }
         ]
       }
     }
   }
   ```

3. **Send a Test SMS:**
   Replace `<IP>`, `<SESSION_TOKEN>`, and `<MODEM_ID>` with your details.
   ```bash
   curl -X POST \
        -H "Authorization: Bearer <SESSION_TOKEN>" \
        -H "Content-Type: application/json" \
        -d '{"data":{"number":"yourtestnumber","message":"yourtestmessage","modem":"<MODEM_ID>"}}' \
        "http://<IP>/api/messages/actions/send"
   ```
   **Expected Response:**
   ```json
   {"success":true,"data":{"sms_used":1}}
   ```

---

### Step 4: Edit the `.env` File and Start the App

**Configure the `.env` File:**
1. Set a random string for `PREDEFINED_TOKEN`:
   ```env
   PREDEFINED_TOKEN=A9B8C7D6E5F4G3H2I1J0K
   ```

2. Configure admin credentials for dashboard access:
   ```env
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=password
   ```

3. Use the provided `SESSION_SECRET` or generate a new one:
   ```env
   SESSION_SECRET=b2db9c2c0870b5979d6e00db9846a8fd7ac1fe1ff23d6c644739d6b6e27a05f0
   ```

4. Add router/gateway credentials. Uncomment and edit for additional devices:
   ```env
   # Device 1 Credentials
   TELTONIKA_USERNAME_1=admin
   TELTONIKA_PASSWORD_1=password
   TELTONIKA_URL_1=https://192.168.0.1

   # Device 2 Credentials (Optional)
   //TELTONIKA_USERNAME_2=admin
   //TELTONIKA_PASSWORD_2=password
   //TELTONIKA_URL_2=https://192.168.0.2
   ```

---

### Step 5: Final Configuration
1. Edit `routes/sms.js` and update the test message with your details:
   ```javascript
   const testMessage = {
       to: 'yourtestnumber',
       message: 'yourtestmessage'
   };
   ```

2. Start the application:
   ```bash
   node server.js
   ```

3. If successful, access the app at `localhost:3000`.

---

### Optional: Deployment
The app can be deployed on Synology or QNAP via Container Station. *(A deployment guide will be available soon.)*
