import bcrypt from 'bcrypt';

/**
 * Password utility for hashing and comparison.
 * Uses bcrypt with 12 rounds for a secure balance between cost and security.
 */

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

export const comparePasswords = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};
