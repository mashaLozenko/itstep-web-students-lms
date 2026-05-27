import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password.
 * @param {string} password - Plain-text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a plain-text password against a hash.
 * @param {string} password - Plain-text password
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>} True if matches
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
