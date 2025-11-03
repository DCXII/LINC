# LINC 

A secure, end-to-end encrypted TCP chat application built with Node.js. It uses `ngrok` to create secure, shareable chat rooms accessible from anywhere.

## Features

* End-to-end TLS encryption
* Simple, shareable Server Codes
* Room-owner permissions (accept/decline, kick, ban)
* File sharing within rooms
* Timestamps and an approved-user list

## How to Run

### Step 1: Install Dependencies

1.  **Install Node.js Packages:**
    Clone the repository and install the required `npm` packages.
    ```bash
    git clone https://github.com/DCXII/LINC.git
    cd LINC
    npm install
    ```

2.  **Install `ngrok`:**
    LINC uses `ngrok` to create secure public tunnels.
    * [Download the `ngrok` binary](https://ngrok.com/download) for your operating system.

### Step 2: One-Time Setup

1.  **Authenticate `ngrok`:**
    [Sign up for a free `ngrok` account](https://dashboard.ngrok.com/signup) to get your authtoken. Run the following command (you only need to do this once):
    ```bash
    ngrok config add-authtoken <YOUR_TOKEN>
    ```

2.  **Generate Security Keys:**
    LINC requires `openssl` (usually pre-installed on Linux/macOS) to create security certificates.
    ```bash
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes -subj "/C=XX/ST=State/L/City/O=Org/OU/Org/CN=localhost"
    ```

### Step 3: Run LINC

You're all set! Just run the launcher:
```bash
node tcp-launcher.js
```
or
```
npm start
```
