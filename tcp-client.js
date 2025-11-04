const tls = require('tls');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 2323;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m'
};

function print(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

let clientRL = null;
let currentPrompt = '';
let fileBuffer = '';
let isReceivingFile = false;

function handleFileDownload(line) {
  if (line.startsWith('::FILE_START::')) {
    isReceivingFile = true;
    fileBuffer = line;
    return true;
  }
  
  if (isReceivingFile) {
    fileBuffer += line;
    if (line.endsWith('::FILE_END::')) {
      isReceivingFile = false;
      
      try {
        const parts = fileBuffer.split('::');
        const filename = parts[2];
        const base64Data = parts[3];
        
        const dlDir = path.join(process.cwd(), 'downloads');
        if (!fs.existsSync(dlDir)) fs.mkdirSync(dlDir, { recursive: true });
        
        let final = filename;
        let n = 1;
        const ext = path.extname(filename);
        const base = path.basename(filename, ext);
        let dest = path.join(dlDir, final);
        
        while (fs.existsSync(dest)) {
          final = `${base}_${n}${ext}`;
          dest = path.join(dlDir, final);
          n++;
        }
        
        const data = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(dest, data);
        
        const kb = (data.length / 1024).toFixed(2);
        const successMsg = `\n${colors.green}[SERVER] Downloaded: ${final} (${kb} KB)${colors.reset}\n   ${colors.dim}Saved to: ${dest}${colors.reset}\n`;
        
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(successMsg);
        clientRL.prompt(true);
        
      } catch (e) {
        process.stdout.write(`\n${colors.red}[SERVER] File download failed: ${e.message}${colors.reset}\n`);
        clientRL.prompt(true);
      }
      
      fileBuffer = '';
    }
    return true;
  }
  return false;
}

function handleServerMessage(message) {
  if (handleFileDownload(message)) return;

  if (!clientRL) {
    if (message.startsWith('Username: ')) {
      setupInterface(message);
    } else {
      process.stdout.write(message + '\n');
    }
    return;
  }

  if (message.startsWith('Username: ')) {
    currentPrompt = message;
    clientRL.setPrompt(currentPrompt);
    clientRL.prompt(true);
  } else if (message.startsWith(`${colors.green}[SERVER] Welcome`)) {
    currentPrompt = '> ';
    clientRL.setPrompt(currentPrompt);
    
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(message + '\n');
    clientRL.prompt(true);
  } else {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(message + '\n');
    clientRL.prompt(true);
  }
}

function setupInterface(initialPrompt) {
  clientRL = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
  
  currentPrompt = initialPrompt;
  clientRL.setPrompt(currentPrompt);

  clientRL.on('line', (line) => {
    if (global.tcpSocket) {
      global.tcpSocket.write(line + '\n');
    }
    clientRL.prompt();
  });

  clientRL.on('close', () => {
    console.log('\n\nGoodbye!');
    if (global.tcpSocket) global.tcpSocket.end();
    process.exit(0);
  });
  
  clientRL.prompt();
}

class TCPChatClient {
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.socket = null;
    this.rl = null;
    this.currentPrompt = '';
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`\nConnecting to ${this.host}:${this.port}... (Secure TLS)`);
      
      const options = {
        host: this.host,
        port: this.port,
        rejectUnauthorized: false 
      };

      this.socket = tls.connect(options, () => {
        console.log('Connected! (Encrypted)');
        global.tcpSocket = this.socket;
        resolve();
      });

      this.socket.setEncoding('utf8');

      this.socket.on('data', (data) => {
        const lines = data.split('\n').filter(l => l.length > 0);
        for (const line of lines) {
          handleServerMessage(line);
        }
      });

      this.socket.on('end', () => {
        console.log('\n\nConnection closed by server');
        process.exit(0);
      });

      this.socket.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
          console.error(`\nCannot connect to ${this.host}:${this.port}`);
          console.error('  Make sure the server is running!');
        } else {
          console.error(`\nConnection error: ${err.message}`);
        }
        reject(err);
      });
    });
  }
}

async function main() {
  console.clear();
  print('██╗    ██╗███╗   ██╗ ██████╗', colors.cyan);
  print('██║    ██║████╗  ██║██╔════╝', colors.cyan);
  print('██║    ██║██╔██╗ ██║██║     ', colors.cyan);
  print('██║    ██║██║╚██╗██║██║     ', colors.cyan);
  print('███████╗██║██║ ╚████║╚██████╗', colors.cyan);
  print('╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝', colors.cyan);
  print('                                    ', colors.cyan);
  print('|-----<SECURE CLI COMMS>----|', colors.green);
  print('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const args = process.argv.slice(2);
  let host = args[0] || DEFAULT_HOST;
  let port = args[1] ? parseInt(args[1]) : DEFAULT_PORT;

  if (args.length === 0) {
    const answer = await new Promise((resolve) => {
      rl.question(`Server address (default: ${DEFAULT_HOST}:${DEFAULT_PORT}): `, resolve);
    });

    if (answer.trim()) {
      const parts = answer.trim().split(':');
      host = parts[0] || DEFAULT_HOST;
      port = parts[1] ? parseInt(parts[1]) : DEFAULT_PORT;
    }
  }

  rl.close();

  const client = new TCPChatClient(host, port);
  
  try {
    await client.connect();
    
    process.on('SIGINT', () => {
      console.log('\n\nDisconnecting...');
      if (client.socket) client.socket.end();
      process.exit(0);
    });

  } catch (err) {
    process.exit(1);
  }
}

main();
