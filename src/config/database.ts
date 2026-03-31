import prisma from '../utils/prisma';

/**
 * Database configuration and initial connection logic.
 * Primarily exports the Prisma client singleton and verifies DB access.
 */

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('[Database] Successful connection established.');
  } catch (error) {
    console.error('[Database] Connection failed:', error);
    process.exit(1);
  }
};

export { prisma };
