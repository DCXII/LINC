# LINC <Secure CLI Comms>

A secure, end-to-end encrypted TCP chat application built with Node.js. It uses `ngrok` to create secure, shareable chat rooms accessible from anywhere.

## Features

* End-to-end TLS encryption
* Simple, shareable Server Codes
* Room-owner permissions (accept/decline, kick, ban)
* File sharing within rooms
* Timestamps and an approved-user list

## How to Run

1.  **Clone & Install:**
    ```bash
    git clone [https://github.com/DCXII/LINC.git](https://github.com/DCXII/LINC.git)
    cd LINC
    npm install
    ```

2.  **Generate Security Keys (One-time setup):**
    ```bash
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes -subj "/C=XX/ST=State/L/City/O=Org/OU/Org/CN=localhost"
    ```

3.  **Setup `ngrok` (One-time setup):**
    * [Download `ngrok`](https://ngrok.com/download) and add it to your PATH.
    * [Sign up for a free account](https://dashboard.ngrok.com/signup) and add your authtoken:
    ```bash
    ngrok config add-authtoken <YOUR_TOKEN>
    ```

4.  **Run LINC:**
    ```bash
    node tcp-launcher.js
    ```
    or
    ```bash
    npm start
    ```
