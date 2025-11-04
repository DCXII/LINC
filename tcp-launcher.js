#!/usr/bin/env node

const tls = require('tls');
const net = require('net');
const http = require('http');
const readline = require('readline');
const { spawn, execSync } = require('child_process');
const { ChatServer } = require('./tcp-server');
const os = require('os');
const fs = require('fs');
const path = require('path');

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

let ngrokProcess = null;

function print(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function printBanner() {
  console.clear();
  print('██╗     ██╗███╗   ██╗ ██████╗', colors.cyan);
  print('██║     ██║████╗  ██║██╔════╝', colors.cyan);
  print('██║     ██║██╔██╗ ██║██║     ', colors.cyan);
  print('██║     ██║██║╚██╗██║██║     ', colors.cyan);
  print('███████╗██║██║ ╚████║╚██████╗', colors.cyan);
  print('╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝', colors.cyan);
  print('                                    ', colors.cyan);
  print('|-----<SECURE CLI COMMS>----|', colors.green);
  print('');
}

function killExistingServer() {
  try {
    print('   Cleaning up old processes...', colors.dim);
    if (os.platform() === 'win32') {
      execSync('netstat -ano | findstr :2323 | findstr LISTENING', { encoding: 'utf8' })
        .split('\n')
        .forEach(line => {
          const match = line.match(/\s+(\d+)\s*$/);
          if (match) {
            try { execSync(`taskkill /F /PID ${match[1]}`, { stdio: 'ignore' }); } catch (e) {}
          }
        });
      try { execSync(`taskkill /F /IM ngrok.exe /T`, { stdio: 'ignore' }); } catch (e) {}
    } else {
      try { execSync('lsof -ti:2323 | xargs kill -9 2>/dev/null', { stdio: 'ignore' }); } catch (err) {}
      try { execSync('fuser -k 2323/tcp 2>/dev/null', { stdio: 'ignore' }); } catch (err) {}
      try { execSync('pkill -f "tcp-server.js" 2>/dev/null', { stdio: 'ignore' }); } catch (err) {}
      try { execSync('pkill -f ngrok', { stdio: 'ignore' }); } catch (err) {}
    }
    print('   ✓ Cleanup complete', colors.dim);
  } catch (err) {
  }
}

function getNgrokConfigPath() {
  const homeDir = os.homedir();
  let v3Path, v2Path;

  switch (os.platform()) {
    case 'linux':
      v3Path = path.join(homeDir, '.config', 'ngrok', 'ngrok.yml');
      break;
    case 'darwin':
      v3Path = path.join(homeDir, 'Library', 'Application Support', 'ngrok', 'ngrok.yml');
      break;
    case 'win32':
      v3Path = path.join(homeDir, 'AppData', 'Local', 'ngrok', 'ngrok.yml');
      break;
  }
  
  if (v3Path && fs.existsSync(v3Path)) {
    return v3Path;
  }

  v2Path = path.join(homeDir, '.ngrok2', 'ngrok.yml');
  if (fs.existsSync(v2Path)) {
    return v2Path;
  }

  return null;
}

function getNgrokServerCode() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const tcpTunnel = json.tunnels.find(t => t.proto === 'tcp');
          if (tcpTunnel && tcpTunnel.public_url) {
            const parts = tcpTunnel.public_url.replace('tcp://', '').split(':');
            const host = parts[0];
            const port = parts[1];
            const hostNum = host.split('.')[0];
            const serverCode = `${hostNum}${port}`;
            resolve(serverCode);
          } else {
            reject(new Error('No TCP tunnel found in ngrok API.'));
          }
        } catch (e) {
          reject(new Error('Failed to parse ngrok API response.'));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`ngrok API not responding: ${err.message}`));
    });
  });
}

function startNgrokTunnel() {
  return new Promise((resolve, reject) => {
    print('   Starting ngrok tunnel in the background...', colors.dim);
    
    const configPath = getNgrokConfigPath();
    
    const ngrokArgs = [
      'tcp', 
      '2323', 
      '--log=stdout'
    ];
    
    if (configPath) {
      print(`   Using config file: ${configPath}`, colors.dim);
      ngrokArgs.push('--config', configPath);
    } else {
      print('   Could not find ngrok config file. This may fail.', colors.yellow);
    }
    
    ngrokProcess = spawn('ngrok', ngrokArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    ngrokProcess.on('error', (err) => {
      reject(new Error(`Failed to start ngrok. Is it in your system PATH? Error: ${err.message}`));
    });

    ngrokProcess.on('close', (code) => {
      if (code !== 0 && code !== null) {
        print(`\n${colors.red}ngrok process exited unexpectedly (code ${code}).${colors.reset}`, colors.red);
      }
    });
    
    ngrokProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('started tunnel')) {
        let retries = 5;
        const poll = async () => {
          try {
            const code = await getNgrokServerCode();
            resolve(code);
          } catch (e) {
            retries--;
            if (retries > 0) {
              await new Promise(r => setTimeout(r, 1000));
              poll();
            } else {
              reject(new Error('ngrok started but API failed. Is your auth token valid?'));
            }
          }
        };
        poll();
      }
    });
    
    ngrokProcess.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('authentication failed')) {
        reject(new Error('ngrok authentication failed! Please add your authtoken.'));
      }
      if (output.includes('ERR_NGROK_108')) {
         reject(new Error('ngrok free account limit: 1 session. Please kill other ngrok processes.'));
      }
    });
  });
}

async function startAsServer() {
  print('Preparing to start server...', colors.yellow);
  
  if (!fs.existsSync('key.pem') || !fs.existsSync('cert.pem')) {
    print('\nERROR: Missing security files.', colors.red);
    print('   Please run this command first to generate keys:', colors.yellow);
    print('\n   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes -subj "/C=XX/ST=State/L/City/O=Org/OU/Org/CN=localhost"\n');
    process.exit(1);
  }
  
  killExistingServer();
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  print('Starting local server...', colors.yellow);
  
  const server = new ChatServer(2323);
  
  try {
    await new Promise((resolve, reject) => {
      server.server.listen(2323, '127.0.0.1', () => resolve());
      server.server.on('error', reject);
    });
    print('   Local server is running', colors.dim);

    const serverCode = await startNgrokTunnel();
    print(`   ngrok tunnel is live!`, colors.dim);


    print('Secure Server is LIVE!\n', colors.green);
    print('╔════════════════════════════════════════════════════╗', colors.cyan);
    print('║              SERVER IS PUBLIC                      ║', colors.bright);
    print('╠════════════════════════════════════════════════════╣', colors.cyan);
    print('║                                                    ║', colors.cyan);
    print(`║  Tell friends to join with this Server Code:       ║`, colors.yellow);
    print('║                                                    ║', colors.cyan);
    print(`║                     ${colors.bright}${serverCode}${colors.reset}${colors.cyan}                         ║`, colors.cyan);
    print('║                                                    ║', colors.cyan);
    print('╚════════════════════════════════════════════════════╝\n', colors.cyan);

    print('Connecting you to the server (as host)...\n', colors.yellow);
    
    try {
      const socket = await connectAsClient('127.0.0.1', 2323);
      
      socket.setEncoding('utf8');
      socket.on('data', (data) => {
        const lines = data.split('\n').filter(l => l.length > 0);
        for (const line of lines) {
          handleClientMessage(line);
        }
        if (clientRL && !clientRL.socket) {
          clientRL.socket = socket;
        }
      });
      socket.on('end', () => {
        print('\n\nYou were disconnected', colors.yellow);
        process.exit(0);
      });
      socket.on('error', (err) => {
         print(`\nLocal connection error: ${err.message}`, colors.red);
         process.exit(1);
      });
    } catch (err) {
      print(`\nFailed to connect to local server: ${err.message}`, colors.red);
      process.exit(1);
    }

  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      print(`\nCould not start server: Port 2323 is stubbornly in use`, colors.red);
    } else {
      print(`\nServer error: ${error.message}`, colors.red);
    }
    if (ngrokProcess) ngrokProcess.kill();
    process.exit(1);
  }
}

let clientRL = null;
let currentPrompt = '';
let fileBuffer = '';
let isReceivingFile = false;

function handleFileDownload(line) {
  if (line.startsWith('::FILE_START::')) {
    isReceivingFile = true;
    fileBuffer = line;
  } else if (isReceivingFile) {
    fileBuffer += line;
  }

  if (isReceivingFile && fileBuffer.endsWith('::FILE_END::')) {
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
      if (clientRL) clientRL.prompt(true);
      
    } catch (e) {
      process.stdout.write(`\n${colors.red}[SERVER] File download failed: ${e.message}${colors.reset}\n`);
      if (clientRL) clientRL.prompt(true);
    }
    
    fileBuffer = '';
    return true;
  }

  if (isReceivingFile) {
    return true;
  }
  
  return false;
}

function handleClientMessage(message) {
  if (handleFileDownload(message)) return;

  if (!clientRL) {
    if (message.startsWith('Username: ')) {
      setupClientInterface(message);
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

function setupClientInterface(initialPrompt) {
  clientRL = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
  
  currentPrompt = initialPrompt;
  clientRL.setPrompt(currentPrompt);

  clientRL.on('line', (line) => {
    const socket = clientRL.socket; 
    if(socket) {
      socket.write(line + '\n');
    }
    clientRL.prompt();
  });

  clientRL.on('close', () => {
    if (clientRL.socket) clientRL.socket.end();
    process.exit(0);
  });
  
  clientRL.prompt();
}

async function connectAsClient(host, port) {
  return new Promise((resolve, reject) => {
    if (host !== '127.0.0.1') {
    }
    
    const options = {
      host: host,
      port: port,
      rejectUnauthorized: false
    };

    const socket = tls.connect(options, () => {
      if (host !== '127.0.0.1') {
      }
      resolve(socket);
    });

    socket.on('error', (err) => {
      if (host !== '127.0.0.1') {
      }
      reject(err);
    });
  });
}

async function promptForCode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    print('Enter the Server Code from the host (e.g. 212345):', colors.bright);
    print('');
    
    rl.question(`Server Code: ${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function connectToCode(code) {
  
  const portStr = code.slice(-5);
  const hostNum = code.slice(0, -5);

  const port = parseInt(portStr);

  if (isNaN(port) || !hostNum) {
    print('Invalid code format. Must be a 6 or 7-digit number.', colors.red);
    process.exit(1);
  }

  const regions = ['io', 'eu', 'au', 'ap', 'in', 'jp', 'sa'];
  const hostsToTry = regions.map(r => `${hostNum}.tcp.${r}.ngrok.io`);
  
  print(`Trying to find server with code ${code}...`, colors.yellow);
  
  for (const host of hostsToTry) {
    try {
      const socket = await connectAsClient(host, port);
      
      print(`Connecting to ${host}:${port}... (Secure TLS)\n`, colors.cyan);
      print('Connected! (Encrypted)\n', colors.green);
      
      socket.setEncoding('utf8');
      socket.on('data', (data) => {
        const lines = data.split('\n').filter(l => l.length > 0);
        for (const line of lines) {
          handleClientMessage(line);
        }
        if (clientRL && !clientRL.socket) {
          clientRL.socket = socket;
        }
      });
      socket.on('end', () => {
        print('\n\nServer disconnected', colors.yellow);
        process.exit(0);
      });
      socket.on('error', (err) => {
         print(`\nConnection error: ${err.message}`, colors.red);
         process.exit(1);
      });
      
      return;

    } catch (err) {
    }
  }

  print(`\nCould not find any server with code: ${code}`, colors.red);
  print('   Please double-check the code or ask the host to restart.', colors.yellow);
  process.exit(1);
}

async function main() {
  printBanner();

  print('What would you like to do?', colors.bright);
  print('  1. Host a server (be the room creator)', colors.green);
  print('  2. Join a server (connect to existing)', colors.cyan);
  print('  3. Exit', colors.red);
  print('\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Choose option (1-3): ', async (choice) => {
    rl.close();
    console.log('');

    switch (choice.trim()) {
      case '1':
        await startAsServer();
        break;

      case '2':
        const code = await promptForCode();
        
        if (code && /^\d{6,}$/.test(code)) {
          await connectToCode(code);
        } else {
          print('Invalid code. It must be at least 6 digits.', colors.red);
          process.exit(1);
        }
        break;

      case '3':
        print('Goodbye!', colors.green);
        process.exit(0);
        break;

      default:
        print('Invalid option', colors.red);
        process.exit(1);
    }
  });
}

process.on('SIGINT', () => {
  print('\n\nShutting down...', colors.yellow);
  if (ngrokProcess) {
    print('   Closing ngrok tunnel...', colors.dim);
    ngrokProcess.kill();
  }
  process.exit(0);
});

main();
