// Genera el valor para APP_PASSWORD_HASH (scrypt, sin dependencias).
// Uso: pnpm run hash-password -- "mi-contraseña"
const { randomBytes, scryptSync } = require('node:crypto');

const password = process.argv[2];

if (!password) {
  console.error('Uso: pnpm run hash-password -- "tu-contraseña"');
  process.exit(1);
}

if (password.length < 10) {
  console.error('Usa al menos 10 caracteres.');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);

console.log(`APP_PASSWORD_HASH=scrypt$${salt.toString('base64')}$${hash.toString('base64')}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString('hex')}`);
