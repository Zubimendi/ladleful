const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 15;
export const ID_PATTERN = /^[a-z0-9]{15}$/;

export function generateId(): string {
  let out = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    const idx = Math.floor(Math.random() * ALPHABET.length);
    out += ALPHABET.charAt(idx);
  }
  return out;
}

export function isValidId(value: string): boolean {
  return ID_PATTERN.test(value);
}
