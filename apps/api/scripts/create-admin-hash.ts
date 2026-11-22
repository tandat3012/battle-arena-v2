// Sinh bcrypt hash cho mật khẩu Admin. Mật khẩu nhập ẩn, không in ra.
// pnpm admin-hash            → in dòng ADMIN_PASSWORD_HASH='...'
// pnpm admin-hash --write    → ghi thẳng vào .env ở gốc repo (tạo từ .env.example nếu chưa có)
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    let value = '';
    if (!stdin.isTTY) {
      stdin.once('data', (d) => resolve(d.toString().trim()));
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    const onData = (buf: Buffer) => {
      for (const ch of buf.toString()) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          return resolve(value);
        }
        if (ch === '\u0003') process.exit(130);
        if (ch === '\u007f') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const password = await askHidden('Mật khẩu Admin (≥ 8 ký tự): ');
if (password.length < 8) {
  console.error('Mật khẩu quá ngắn.');
  process.exit(1);
}
const line = `ADMIN_PASSWORD_HASH='${await bcrypt.hash(password, 12)}'`;

if (process.argv.includes('--write')) {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const envPath = `${root}.env`;
  if (!existsSync(envPath)) copyFileSync(`${root}.env.example`, envPath);
  const content = readFileSync(envPath, 'utf8');
  const next = /^ADMIN_PASSWORD_HASH=.*$/m.test(content) ? content.replace(/^ADMIN_PASSWORD_HASH=.*$/m, line) : `${content}\n${line}\n`;
  writeFileSync(envPath, next);
  console.log(`Đã ghi ADMIN_PASSWORD_HASH vào ${envPath}`);
} else {
  console.log(line);
}
