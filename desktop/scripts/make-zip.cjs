const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const source = path.join(dist, 'win-unpacked');
const output = path.join(dist, 'HSArriverTurbo-portable.zip');
if (!fs.existsSync(source)) throw new Error(`未找到 Electron 便携目录：${source}`);
if (fs.existsSync(output)) fs.rmSync(output, { force: true });
const command = `Compress-Archive -Path '${source.replaceAll("'", "''")}\\*' -DestinationPath '${output.replaceAll("'", "''")}' -Force`;
execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'inherit' });
console.log(output);
