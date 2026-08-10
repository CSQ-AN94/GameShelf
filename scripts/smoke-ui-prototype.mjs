import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';

if (process.platform !== 'win32') throw new Error('This packaged-app smoke check runs on Windows');

const executable = path.resolve('out', 'GameShelf-win32-x64', 'GameShelf.exe');
const port = 9339;
const child = spawn(executable, ['--ui-prototype', `--remote-debugging-port=${port}`], { stdio: 'ignore' });

async function pageTarget() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = targets.find((target) => target.type === 'page');
      if (page) return page;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Packaged app did not expose a page target');
}

async function inspectPage(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('DevTools evaluation timed out')), 3000);
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timeout);
      resolve(message.result.result.value);
    });
    socket.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `({ url: location.href, prototype: Boolean(document.querySelector('.ui-prototype')), switcher: Boolean(document.querySelector('.variant-switcher')) })`,
        returnByValue: true
      }
    }));
  });
  socket.close();
  return result;
}

try {
  const page = await pageTarget();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const result = await inspectPage(page.webSocketDebuggerUrl);
  console.log(JSON.stringify(result));
  if (!result.prototype || !result.switcher) throw new Error('Packaged app opened the normal UI instead of the prototype');
} finally {
  try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
}
