import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient(); // <-- Скобки пустые! Всё берется из schema.prisma
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
