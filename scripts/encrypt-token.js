const crypto = require('crypto');
const fs = require('fs');

function deriveKey(pass) {
  return crypto.createHash('sha256').update(pass).digest();
}

function encrypt(plain, pass) {
  const key = deriveKey(pass);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('base64') + ':' + tag.toString('base64') + ':' + ct.toString('base64');
}

async function main() {
  const pass = process.env.ENCRYPT_PW;
  const token = process.env.TOKEN || process.argv[2];
  const outFile = process.argv[3] || 'encrypted.token';

  if (!pass) {
    console.error('ENCRYPT_PW must be set');
    process.exit(2);
  }
  if (!token) {
    console.error('TOKEN must be passed as env var or first arg');
    process.exit(2);
  }

  const encrypted = encrypt(token, pass);
  fs.writeFileSync(outFile, encrypted, { encoding: 'utf8', flag: 'w' });
  console.log('Wrote', outFile);
}

main().catch((e) => { console.error(e); process.exit(1); });
