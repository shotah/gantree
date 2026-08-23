import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const MIN_PASSPHRASE = 10;
export const MAX_PASSPHRASE = 128;
export const NAME_RE = /^[a-zA-Z0-9._-]{2,32}$/;

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const HASH_LEN = 32;
const DUMMY_SALT = Buffer.alloc(16, 7);
const DUMMY_INPUT = "x";

export function hashPassphrase(passphrase: string): { salt: Buffer; hash: Buffer } {
  const salt = randomBytes(16);
  const hash = scryptSync(passphrase, salt, HASH_LEN, SCRYPT);
  return { salt, hash };
}

export function verifyPassphrase(passphrase: string, salt: Uint8Array, expected: Uint8Array): boolean {
  const hash = scryptSync(passphrase, Buffer.from(salt), HASH_LEN, SCRYPT);
  const want = Buffer.from(expected);
  if (hash.length !== want.length) {
    return false;
  }
  return timingSafeEqual(hash, want);
}

export function dummyHash(passphrase: string): void {
  const input = passphrase.length <= MAX_PASSPHRASE ? passphrase : DUMMY_INPUT;
  scryptSync(input, DUMMY_SALT, HASH_LEN, SCRYPT);
}

export function dummyInput(): string {
  return DUMMY_INPUT;
}

export function validateCredentials(name: string, passphrase: string): string | null {
  if (!NAME_RE.test(name.trim())) {
    return "name must be 2–32 letters, digits, dot, underscore, or hyphen";
  }
  return validatePassphrase(passphrase, name);
}

export function validatePassphrase(passphrase: string, name: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE) {
    return `passphrase must be at least ${MIN_PASSPHRASE} characters`;
  }
  if (passphrase.length > MAX_PASSPHRASE) {
    return `passphrase must be at most ${MAX_PASSPHRASE} characters`;
  }
  if (!passphrase.trim()) {
    return "passphrase cannot be empty";
  }
  const n = name.trim().toLowerCase();
  const p = passphrase.toLowerCase();
  const stripped = p.replace(/[\s._-]/g, "");
  if (n && (p === n || (n.length >= 2 && stripped.length >= MIN_PASSPHRASE && stripped.replaceAll(n, "") === ""))) {
    return "passphrase cannot be your name";
  }
  if (new Set(passphrase).size < 4 || /^\d+$/.test(passphrase) || STUPID.has(p) || STUPID.has(stripped) || trivialPattern(p)) {
    return "passphrase is too common or too simple";
  }
  return null;
}

const STUPID = new Set([
  "null",
  "undefined",
  "none",
  "nil",
  "true",
  "false",
  "password123",
  "password12",
  "password1!",
  "password1234",
  "password12!",
  "passwordpassword",
  "1234567890",
  "12345678910",
  "qwertyuiop",
  "qwerty1234",
  "qwerty12345",
  "abcdefghij",
  "1q2w3e4r5t",
  "1qaz2wsx3e",
  "adminadmin",
  "admin12345",
  "admin123456",
  "letmein123",
  "letmein1234",
  "welcome123",
  "welcome1234",
  "passw0rd12",
  "passw0rd123",
  "passw0rd!",
  "p@ssw0rd12",
  "p@ssw0rd123",
  "p@ssword1",
  "iloveyou123",
  "monkey1234",
  "dragon1234",
  "baseball123",
  "football123",
  "sunshine123",
  "princess123",
  "starwars123",
  "changeme123",
  "trustno1!!",
  "0000000000",
  "1111111111",
  "aaaaaaaaaa",
  "abc1234567",
  "qwertyqwerty",
  "rootrootroot",
  "gantree123",
  "gantry1234",
  "testtest12",
  "guestguest1",
]);

function trivialPattern(p: string): boolean {
  if (/^password\d*!*$/.test(p)) {
    return true;
  }
  if (/^(welcome|admin|letmein|qwerty|passw0rd|changeme|gantree|gantry)\d*!*$/.test(p)) {
    return true;
  }
  if (/^(spring|summer|autumn|fall|winter)\d{2,4}!*$/.test(p)) {
    return true;
  }
  const compact = p.replace(/[^a-z0-9]/g, "");
  const runs = [
    "abcdefghijklmnopqrstuvwxyz",
    "zyxwvutsrqponmlkjihgfedcba",
    "0123456789",
    "9876543210",
    "qwertyuiopasdfghjkl",
    "qwertyuiop",
  ];
  return compact.length >= 8 && runs.some((run) => run.includes(compact));
}
