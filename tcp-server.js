const tls = require('tls');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const tlsOptions = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
  rejectUnauthorized: false
};

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

const PORT = 2323;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

const rooms = new Map();
const clients = new Map();
const activeUsernames = new Set();

function getTime() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  return `${colors.gray}[${h}:${m}:${s}]${colors.reset}`;
}

class ChatServer {
  constructor(port) {
    this.port = port;
    this.server = tls.createServer(tlsOptions, this.handleConnection.bind(this));
  }

  handleConnection(socket) {
    const client = {
      username: null,
      room: null,
      isOwner: false,
      socket: socket,
    };
    clients.set(socket, client);

    socket.setEncoding('utf8');
    this.write(socket, 'Username: ');

    const rl = readline.createInterface({ input: socket });

    rl.on('line', (line) => {
      this.handleInput(socket, line.trim());
    });

    socket.on('end', () => {
      rl.close();
      this.disconnect(socket);
    });
    socket.on('error', () => {
      rl.close();
      this.disconnect(socket);
    });
  }

  write(socket, text) {
    try {
      if (!text.endsWith('\n')) {
        text += '\n';
      }
      socket.write(text);
    } catch (e) {
    }
  }

  handleInput(socket, line) {
    const client = clients.get(socket);
    if (!client) return;

    if (!line && !client.username) {
      this.write(socket, 'Username: ');
      return;
    }

    if (!client.username) {
      this.setUsername(socket, line);
    } else if (line) {
      this.processCommand(socket, line);
    }
  }

  setUsername(socket, name) {
    const client = clients.get(socket);

    if (activeUsernames.has(name)) {
      this.write(socket, `${colors.red}[SERVER] Username taken!${colors.reset}`);
      this.write(socket, 'Username: ');
      return;
    }

    client.username = name;
    activeUsernames.add(name);

    this.write(socket, `${colors.green}[SERVER] Welcome, ${name}!${colors.reset}`);
    this.write(socket, `${colors.dim}[SERVER] Type /help for commands${colors.reset}`);
  }

  processCommand(socket, input) {
    const client = clients.get(socket);

    if (input.startsWith('/')) {
      const [cmd, ...args] = input.slice(1).split(' ');
      const argString = args.join(' ');

      switch (cmd.toLowerCase()) {
        case 'help': this.cmdHelp(socket); break;
        case 'join': case 'j': this.cmdJoin(socket, argString); break;
        case 'list': this.cmdList(socket); break;
        case 'names': case 'who': this.cmdNames(socket); break;
        case 'topic': this.cmdTopic(socket, argString); break;
        case 'kick': this.cmdKick(socket, argString); break;
        case 'ban': this.cmdBan(socket, argString); break;
        case 'unban': this.cmdUnban(socket, argString); break;
        case 'bans': this.cmdBans(socket); break;
        case 'share': this.cmdShare(socket, argString); break;
        case 'get': case 'download': this.cmdGet(socket, argString); break;
        case 'files': this.cmdFiles(socket); break;
        case 'part': case 'leave': this.cmdLeave(socket); break;
        case 'accept': this.cmdAccept(socket, argString); break;
        case 'decline': this.cmdDecline(socket, argString); break;
        case 'acceptall': this.cmdAcceptAll(socket); break;
        case 'declineall': this.cmdDeclineAll(socket); break;
        case 'quit': case 'exit': this.write(socket, 'Bye!'); socket.end(); break;
        default: this.write(socket, `${colors.red}[SERVER] Unknown: /${cmd}${colors.reset}`); break;
      }
    } else {
      if (client.room) {
        this.sendMessage(client.room, client.username, input, socket);
      } else {
        this.write(socket, `${colors.yellow}[SERVER] Join a room first. (/join <room>)${colors.reset}`);
      }
    }
  }

  cmdHelp(socket) {
    const client = clients.get(socket);
    this.write(socket, `\n${colors.bright}[SERVER] Commands:${colors.reset}`);
    if (!client.room) {
      this.write(socket, `  ${colors.cyan}/join <room>${colors.reset}   Join/create room`);
      this.write(socket, `  ${colors.cyan}/list${colors.reset}         List rooms`);
    } else {
      if (client.isOwner) {
        this.write(socket, `  ${colors.cyan}/topic <txt>${colors.reset}  Set topic (owner)`);
        this.write(socket, `  ${colors.cyan}/kick <user>${colors.reset}  Kick user (owner)`);
        this.write(socket, `  ${colors.cyan}/ban <user>${colors.reset}   Ban user (owner)`);
        this.write(socket, `  ${colors.cyan}/unban <u>${colors.reset}    Unban (owner)`);
        this.write(socket, `  ${colors.cyan}/bans${colors.reset}         List bans (owner)`);
        this.write(socket, `  ${colors.cyan}/accept <u>${colors.reset}   Accept user (owner)`);
        this.write(socket, `  ${colors.cyan}/decline <u>${colors.reset}  Decline user (owner)`);
        this.write(socket, `  ${colors.cyan}/acceptall${colors.reset}  Accept all (owner)`);
        this.write(socket, `  ${colors.cyan}/declineall${colors.reset} Decline all (owner)`);
      }
      this.write(socket, `  ${colors.cyan}/names${colors.reset}        List users`);
      this.write(socket, `  ${colors.cyan}/share <file>${colors.reset} Share file`);
      this.write(socket, `  ${colors.cyan}/get <file>${colors.reset}   Download file`);
      this.write(socket, `  ${colors.cyan}/files${colors.reset}        List files`);
      this.write(socket, `  ${colors.cyan}/part${colors.reset}         Leave room`);
    }
    this.write(socket, `  ${colors.cyan}/help${colors.reset}         This help`);
    this.write(socket, `  ${colors.cyan}/quit${colors.reset}         Exit\n`);
  }

  cmdJoin(socket, roomName) {
    const client = clients.get(socket);

    if (!roomName) {
      this.write(socket, `${colors.red}[SERVER] Usage: /join <room>${colors.reset}`);
      return;
    }

    if (client.room) {
      this.write(socket, `${colors.red}[SERVER] Leave current room first (/part)${colors.reset}`);
      return;
    }

    if (!rooms.has(roomName)) {
      rooms.set(roomName, {
        owner: socket,
        users: [],
        pending: [],
        approved: [client.username],
        topic: '',
        banned: [],
        files: []
      });
      client.isOwner = true;
      this.write(socket, `${colors.green}[SERVER] Created #${roomName}${colors.reset}`);
      this.write(socket, `${colors.green}[SERVER] You are the owner${colors.reset}`);
      const room = rooms.get(roomName);
      room.users.push({ socket, username: client.username });
      client.room = roomName;
    } else {
      const room = rooms.get(roomName);

      if (room.banned.includes(client.username)) {
        this.write(socket, `${colors.red}[SERVER] You are banned from this room!${colors.reset}`);
        return;
      }
      
      if (room.approved.includes(client.username)) {
        this.write(socket, `${colors.green}[SERVER] Welcome back! Re-joined #${roomName}${colors.reset}`);
        
        room.users.push({ socket, username: client.username });
        client.room = roomName;
        client.isOwner = false;
        
        if (room.topic) {
          this.write(socket, `${colors.magenta}[SERVER] Topic: ${room.topic}${colors.reset}`);
        }
        const userList = room.users.map(u => u.username).join(', ');
        this.write(socket, `${colors.dim}[SERVER] Users: ${userList}${colors.reset}`);
        this.broadcast(roomName, `*** ${client.username} joined`, socket);
        
        return;
      }
      
      room.pending.push({ socket, username: client.username });
      this.write(socket, `${colors.yellow}[SERVER] Waiting for owner to accept your request...${colors.reset}`);
      this.write(room.owner, `${colors.cyan}[SERVER] ${client.username} wants to join.${colors.reset}`);
      this.write(room.owner, `${colors.cyan}[SERVER] Type /accept ${client.username} or /decline ${client.username}${colors.reset}`);
    }
  }
  
  _acceptUser(room, pendingUser) {
    room.users.push(pendingUser);
    room.approved.push(pendingUser.username);
    
    const targetClient = clients.get(pendingUser.socket);
    targetClient.room = room.name;
    targetClient.isOwner = false;

    this.write(pendingUser.socket, `${colors.green}[SERVER] Owner accepted your request. Joined #${room.name}${colors.reset}`);
    
    if (room.topic) {
      this.write(pendingUser.socket, `${colors.magenta}[SERVER] Topic: ${room.topic}${colors.reset}`);
    }
    
    const userList = room.users.map(u => u.username).join(', ');
    this.write(pendingUser.socket, `${colors.dim}[SERVER] Users: ${userList}${colors.reset}`);

    this.broadcast(room.name, `*** ${pendingUser.username} joined`);
  }

  cmdAccept(socket, username) {
    const client = clients.get(socket);
    if (!client.room) return;
    const room = rooms.get(client.room);
    room.name = client.room;

    if (room.owner !== socket) {
      this.write(socket, `${colors.red}[SERVER] Owner only${colors.reset}`);
      return;
    }
    
    const pendingUser = room.pending.find(u => u.username === username);
    if (!pendingUser) {
      this.write(socket, `${colors.red}[SERVER] User not found in pending list.${colors.reset}`);
      return;
    }
    
    room.pending = room.pending.filter(u => u.username !== username);
    this._acceptUser(room, pendingUser);
  }
  
  cmdAcceptAll(socket) {
    const client = clients.get(socket);
    if (!client.room) return;
    const room = rooms.get(client.room);
    room.name = client.room;

    if (room.owner !== socket) {
      this.write(socket, `${colors.red}[SERVER] Owner only${colors.reset}`);
      return;
    }

    if (room.pending.length === 0) {
      this.write(socket, `${colors.yellow}[SERVER] No users are pending.${colors.reset}`);
      return;
    }
    
    this.write(socket, `${colors.green}[SERVER] Accepting all pending users...${colors.reset}`);
    
    [...room.pending].forEach(pendingUser => {
      this._acceptUser(room, pendingUser);
    });
    room.pending = [];
  }
  
  _declineUser(room, pendingUser, ownerUsername) {
     this.write(pendingUser.socket, `${colors.red}[SERVER] Owner (${ownerUsername}) declined your request.${colors.reset}`);
  }
  
  cmdDecline(socket, username) {
    const client = clients.get(socket);
    if (!client.room) return;
    const room = rooms.get(client.room);

    if (room.owner !== socket) {
      this.write(socket, `${colors.red}[SERVER] Owner only${colors.reset}`);
      return;
    }
    
    const pendingUser = room.pending.find(u => u.username === username);
    if (!pendingUser) {
      this.write(socket, `${colors.red}[SERVER] User not found in pending list.${colors.reset}`);
      return;
    }
    
    room.pending = room.pending.filter(u => u.username !== username);
    
    this._declineUser(room, pendingUser, client.username);
    this.write(socket, `${colors.yellow}[SERVER] You declined ${username}.${colors.reset}`);
  }
  
  cmdDeclineAll(socket) {
    const client = clients.get(socket);
    if (!client.room) return;
    const room = rooms.get(client.room);

    if (room.owner !== socket) {
      this.write(socket, `${colors.red}[SERVER] Owner only${colors.reset}`);
      return;
    }
    
    if (room.pending.length === 0) {
      this.write(socket, `${colors.yellow}[SERVER] No users are pending.${colors.reset}`);
      return;
    }
    
    this.write(socket, `${colors.red}[SERVER] Declining all pending users...${colors.reset}`);
    
    [...room.pending].forEach(pendingUser => {
      this._declineUser(room, pendingUser, client.username);
    });
    room.pending = [];
  }

  cmdList(socket) {
    this.write(socket, `\n${colors.bright}[SERVER] Rooms:${colors.reset}`);
    if (rooms.size === 0) {
      this.write(socket, `  ${colors.dim}(None)${colors.reset}`);
    } else {
      for (const [name, room] of rooms) {
        this.write(socket, `  ${colors.cyan}#${name}${colors.reset} (${room.users.length} users)`);
      }
    }
    this.write(socket, '');
  }

  cmdNames(socket) {
    const client = clients.get(socket);
    if (!client.room) {
      this.write(socket, `${colors.red}[SERVER] Not in room${colors.reset}`);
      return;
    }

    const room = rooms.get(client.room);
    this.write(socket, `\n${colors.bright}[SERVER] Users:${colors.reset}`);
    room.users.forEach(u => {
      const tag = u.socket === room.owner ? ` ${colors.yellow}(owner)${colors.reset}` : '';
      this.write(socket, `  ${u.username}${tag}`);
    });
    
    if (room.pending.length > 0) {
      this.write(socket, `\n${colors.bright}[SERVER] Pending:${colors.reset}`);
      room.pending.forEach(u => {
        this.write(socket, `  ${u.username} ${colors.dim}(waiting)${colors.reset}`);
      });
    }
    this.write(socket, '');
  }

  cmdTopic(socket, topic) {
    const client = clients.get(socket);
    if (!client.room) return;

    const room = rooms.get(client.room);
    if (room.owner !== socket) {
      this.write(socket, `${colors.red}[SERVER] Owner only${colors.reset}`);
      return;
    }

    room.topic = topic;
    this.broadcast(client.room, `*** Topic: ${topic}`);
  }

  cmdKick(socket, username) {
    const client = clients.get(socket);
    if (!client.room) return;
    const room = rooms.get(client.room);

    if (room.owner !== socket) {
      this.write(socket, `${colors.red}[SERVER] Owner only${colors.reset}`);
      return;
    }

    const target = room.users.find(u => u.username === username);
    if (!target) {
      this.write(socket, `${colors.red}[SERVER] User not found${colors.reset}`);
      return;
    }

    this.write(target.socket, `${colors.red}[SERVER] Kicked by ${client.username}${colors.reset}`);
    this.cmdLeave(target.socket, true);
    this.broadcast(client.room, `*** ${username} was kicked`);
  }

  cmdBan(socket, username) {
    const client = clients.get(socket);
    if (!client.room) return;
    const room = rooms.get(client.room);

    if (room.owner !== socket) {
      this.write(socket, `${colors.red}[SERVER] Owner only${colors.reset}`);
      return;
    }

    if (room.banned.includes(username)) {
      this.write(socket, `${colors.red}[SERVER] Already banned${colors.reset}`);
      return;
    }

    room.banned.push(username);
    this.broadcast(client.room, `*** ${username} was banned`);

    const target = room.users.find(u => u.username === username);
    if (target) {
      this.write(target.socket, `${colors.red}[SERVER] Banned by ${client.username}${colors.reset}`);
      this.cmdLeave(target.socket, true);
    }
  }

  cmdUnban(socket, username) {
    const client = clients.get(socket);
    if (!client.room) return;
    const room = rooms.get(client.room);

    if (room.owner !== socket) {
      this.write(socket, `${colors.red}[SERVER] Owner only${colors.reset}`);
      return;
    }

    const idx = room.banned.indexOf(username);
    if (idx === -1) {
      this.write(socket, `${colors.red}[SERVER] Not banned${colors.reset}`);
      return;
    }

    room.banned.splice(idx, 1);
    this.write(socket, `${colors.green}[SERVER] ${username} unbanned${colors.reset}`);
  }

  cmdBans(socket) {
    const client = clients.get(socket);
    if (!client.room) return;
    const room = rooms.get(client.room);

    if (room.owner !== socket) {
      this.write(socket, `${colors.red}[SERVER] Owner only${colors.reset}`);
      return;
    }

    if (room.banned.length === 0) {
      this.write(socket, `${colors.yellow}[SERVER] No bans${colors.reset}`);
    } else {
      this.write(socket, `\n${colors.bright}[SERVER] Banned:${colors.reset}`);
      room.banned.forEach(u => this.write(socket, `  ${colors.red}${u}${colors.reset}`));
      this.write(socket, '');
    }
  }

  cmdShare(socket, filepath) {
    const client = clients.get(socket);
    if (!client.room) {
      this.write(socket, `${colors.red}[SERVER] Not in room${colors.reset}`);
      return;
    }
    if (!filepath) {
      this.write(socket, `${colors.red}[SERVER] Usage: /share <path>${colors.reset}`);
      return;
    }

    if (filepath.startsWith('~')) filepath = filepath.replace('~', os.homedir());

    if (!fs.existsSync(filepath)) {
      this.write(socket, `${colors.red}[SERVER] File not found${colors.reset}`);
      return;
    }

    try {
      const filename = path.basename(filepath);
      const data = fs.readFileSync(filepath);
      const room = rooms.get(client.room);
      
      let final = filename;
      let n = 1;
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      
      while (room.files.some(f => f.filename === final)) {
        final = `${base}_${n}${ext}`;
        n++;
      }
      
      fs.writeFileSync(path.join(UPLOAD_DIR, `${client.room}_${final}`), data);
      
      room.files.push({
        filename: final,
        sender: client.username,
        size: data.length
      });

      const kb = (data.length / 1024).toFixed(2);
      this.write(socket, `${colors.green}[SERVER] Shared: ${final} (${kb} KB)${colors.reset}`);
      this.broadcast(client.room, `*** ${client.username} shared: ${final} (${kb} KB)`, socket);
    } catch (e) {
      this.write(socket, `${colors.red}[SERVER] Error: ${e.message}${colors.reset}`);
    }
  }

  cmdGet(socket, filename) {
    const client = clients.get(socket);
    if (!client.room) {
      this.write(socket, `${colors.red}[SERVER] Not in room${colors.reset}`);
      return;
    }
    if (!filename) {
      this.write(socket, `${colors.red}[SERVER] Usage: /get <file>${colors.reset}`);
      return;
    }

    const room = rooms.get(client.room);
    const file = room.files.find(f => f.filename === filename);
    
    if (!file) {
      this.write(socket, `${colors.red}[SERVER] Not found${colors.reset}`);
      return;
    }

    const src = path.join(UPLOAD_DIR, `${client.room}_${filename}`);
    if (!fs.existsSync(src)) {
      this.write(socket, `${colors.red}[SERVER] File gone${colors.reset}`);
      return;
    }

    try {
      const data = fs.readFileSync(src);
      const base64Data = data.toString('base64');
      this.write(socket, `::FILE_START::${filename}::${base64Data}::FILE_END::`);
    } catch (e) {
      this.write(socket, `${colors.red}[SERVER] Error reading file: ${e.message}${colors.reset}`);
    }
  }

  cmdFiles(socket) {
    const client = clients.get(socket);
    if (!client.room) {
      this.write(socket, `${colors.red}[SERVER] Not in room${colors.reset}`);
      return;
    }

    const room = rooms.get(client.room);
    if (room.files.length === 0) {
      this.write(socket, `${colors.yellow}[SERVER] No files${colors.reset}`);
    } else {
      this.write(socket, `\n${colors.bright}[SERVER] Files:${colors.reset}`);
      room.files.forEach(f => {
        const kb = (f.size / 1024).toFixed(2);
        this.write(socket, `  ${colors.cyan}${f.filename}${colors.reset} (${kb} KB by ${f.sender})`);
      });
      this.write(socket, '');
    }
  }

  cmdLeave(socket, silent = false) {
    const client = clients.get(socket);
    if (!client.room) {
      if (!silent) {
        this.write(socket, `${colors.red}[SERVER] Not in room${colors.reset}`);
      }
      return;
    }

    const roomName = client.room;
    const room = rooms.get(roomName);
    
    if (room) {
      room.users = room.users.filter(u => u.socket !== socket);
      if (!silent) {
        this.broadcast(roomName, `*** ${client.username} left`, socket);
      }
      if (room.users.length === 0) rooms.delete(roomName);
    }
    
    client.room = null;
    client.isOwner = false;

    if (!silent) {
      this.write(socket, `\n${colors.yellow}[SERVER] Left room${colors.reset}\n`);
    }
  }

  getUserColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % 6;
    return `\x1b[${91 + colorIndex}m`;
  }

  sendMessage(roomName, username, text, senderSocket) {
    const room = rooms.get(roomName);
    const userColor = this.getUserColor(username);
    const msg = `${getTime()} ${colors.gray}[#${roomName}]${colors.reset} ${userColor}<${username}>${colors.reset} ${text}`;
    
    room.users.forEach(u => {
      if (u.socket !== senderSocket) {
        this.write(u.socket, msg);
      }
    });
  }

  broadcast(roomName, text, exclude = null) {
    const room = rooms.get(roomName);
    if (!room) return;
    const msg = `${getTime()} ${colors.gray}[#${roomName}]${colors.reset} ${colors.yellow}${text}${colors.reset}`;

    room.users.forEach(u => {
      if (u.socket !== exclude) {
        this.write(u.socket, msg);
      }
    });
  }

  disconnect(socket) {
    const client = clients.get(socket);
    if (!client) return;
    
    if (client.room) {
        const room = rooms.get(client.room);
        if (room) {
            room.pending = room.pending.filter(u => u.socket !== socket);
        }
    }

    if (client.username) activeUsernames.delete(client.username);
    if (client.room) this.cmdLeave(socket, true);
    clients.delete(socket);
  }

  start() {
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`[SERVER] Running on port ${this.port}`);
    });

    this.server.on('error', (err) => {
      console.error(`[SERVER] Error: ${err.message}`);
      process.exit(1);
    });
  }
}

if (require.main === module) {
  new ChatServer(PORT).start();
}

module.exports = { ChatServer };
