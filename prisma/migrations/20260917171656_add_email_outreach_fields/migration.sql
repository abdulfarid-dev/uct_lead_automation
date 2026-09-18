-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "emailError" TEXT,
ADD COLUMN     "emailScheduledAt" TIMESTAMP(3),
ADD COLUMN     "emailSentAt" TIMESTAMP(3),
ADD COLUMN     "emailStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
