```
██╗     ██╗███╗   ██╗ ██████╗
██║     ██║████╗  ██║██╔════╝
██║     ██║██╔██╗ ██║██║     
██║     ██║██║╚██╗██║██║     
███████╗██║██║ ╚████║╚██████╗
╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝
|-----<SECURE CLI COMMS>----|
```

### |-----\<SECURE CLI COMMS\>----|

LINC is a private, secret chat room you can run on your computer. You can invite your friends to join from anywhere in the world using a secret code.

Because you run it yourself, your chats are end-to-end encrypted and secure.

-----

## Interface Preview

### Main Menu

When you start LINC, you'll see a simple menu:

```bash
What would you like to do?

  1. Host a server (be the room creator)
  2. Join a server (connect to existing)
  3. Exit

Choose option (1-3):
```

### In-App Commands

Once you host or join, you can use simple commands to navigate.

```bash
> Connecting you to the server (as host)...

Username: alice
[SERVER] Welcome, alice!
[SERVER] Type /help for commands
> /help
[SERVER] Commands:
  /join <room>   Join/create room
  /list         List rooms
  /help         This help
  /quit         Exit
> /join room1
[SERVER] Created #room1
[SERVER] You are the owner
> /help
[SERVER] Commands:
  /topic <txt>  Set topic (owner)
  /kick <user>  Kick user (owner)
  /ban <user>   Ban user (owner)
  /unban <u>    Unban (owner)
  /bans         List bans (owner)
  /accept <u>   Accept user (owner)
  /decline <u>  Decline user (owner)
  /names        List users
  /share <file> Share file
  /get <file>   Download file
  /files        List files
  /part         Leave room
  /help         This help
  /quit         Exit
>
```

-----

## Features Explained

  * **End-to-End TLS Encryption:** All communication between you and your friends is fully encrypted. No one in the middle (not your ISP, not `ngrok`) can read your messages.
  * **Secure `ngrok` Tunneling:** Uses `ngrok` to create a secure "tunnel" from your computer to the public internet, allowing friends to connect without you needing to configure routers or firewalls.
  * **Simple Server Codes:** Forget IP addresses. As a host, you get a simple, 6 or 7-digit code (like `212345`) to share.
  * **Owner-Only Room Access:** As the room owner, you have total control. New users are placed in a queue, and you are notified. You must type `/accept <username>` to let them in.
  * **Persistent Approvals:** Once you `/accept` a user into a room, they are added to that room's "approved" list. If they leave and come back later, they can rejoin instantly without needing permission again.
  * **Full Room Moderation:** As the owner, you can `/kick` a user (they can try to rejoin) or `/ban` a user (they are permanently blocked from the room).
  * **Secure File Sharing:** Use the `/share <path/to/file.txt>` command to upload a file to the room. Other users can then see it with `/files` and download it with `/get <file.txt>`.
  * **Self-Hosted:** LINC runs entirely on your machine. There is no central server, no company tracking your data, and no one storing your chat logs. When you shut it down, it's gone.

-----

## How to Get Started (for a 10-Year-Old\!)

Follow these 3 steps to get LINC working. You only have to do most of these once\!

### Step 1: Get the Tools

You need three free tools to make LINC work.

1.  **Get LINC (This Project):**
    First, download the LINC code. Open your terminal and type:

    ```bash
    git clone https://github.com/DCXII/LINC.git
    cd LINC
    ```

2.  **Get Node.js (The "Engine"):**
    LINC is written in Node.js. If you don't have it, [install it from here](https://nodejs.org/). After it's installed, run this command in your `LINC` folder to get the small tools it needs:

    ```bash
    npm install
    ```

3.  **Get `ngrok` (The "Tunnel"):**
    This is the magic tool that connects your computer to the internet so your friends can join.

      * [Download `ngrok`](https://www.google.com/search?q=%5Bhttps://ngrok.com/download%5D\(https://ngrok.com/download\)) for your computer.
      * Unzip the file. This gives you the `ngrok` program.
      * (Important\!) Move this `ngrok` program to a system folder so your computer can find it.
          * **On macOS/Linux:** `sudo mv ./ngrok /usr/local/bin/`
          * **On Windows:** Add the folder containing `ngrok.exe` to your "Environment Variables."

### Step 2: One-Time Setup

Now you just have to "activate" your tools.

1.  **Activate `ngrok`:**

      * [Sign up for a free `ngrok` account](https://www.google.com/search?q=%5Bhttps://dashboard.ngrok.com/signup%5D\(https://dashboard.ngrok.com/signup\)) to get your "authtoken" (it's like a secret password).
      * In your terminal, copy-paste the command they give you. It looks like this:

    <!-- end list -->

    ```bash
    ngrok config add-authtoken <YOUR_SECRET_TOKEN_HERE>
    ```

2.  **Create Your "Secret Keys":**
    This command makes the files (`key.pem` and `cert.pem`) that LINC uses to encrypt your chat.

    ```bash
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes -subj "/C=XX/ST=State/L/City/O=Org/OU/Org/CN=localhost"
    ```

### Step 3: Run LINC\!

You're all set\! From now on, you only need this one command to start your server.

```bash
node tcp-launcher.js
```

Or, even easier:

```bash
npm start
```

-----

## How to Use LINC

LINC will ask you what you want to do:

### **To Host a Server:**

1.  Choose **"1. Host a server"**.
2.  Your computer will start the server and the `ngrok` tunnel.
3.  You will see a **Server Code** (like `212345`).
4.  Give this code to your friends\!
5.  When your friend tries to join, your terminal will say `[SERVER] username wants to join.`
6.  Type `/accept username` to let them in.

### **To Join a Server:**

1.  Choose **"2. Join a server"**.
2.  Type in the **Server Code** your friend gave you.
3.  Wait for the host to `/accept` you.
4.  You're in\!
