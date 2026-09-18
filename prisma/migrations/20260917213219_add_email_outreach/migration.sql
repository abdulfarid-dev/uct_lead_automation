-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "emailBody" TEXT,
ADD COLUMN     "emailSenderAddress" TEXT,
ADD COLUMN     "emailSenderId" INTEGER,
ADD COLUMN     "emailSenderName" TEXT,
ADD COLUMN     "emailSubject" TEXT,
ADD COLUMN     "emailTemplateId" INTEGER,
ADD COLUMN     "emailTemplateName" TEXT;

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSender" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_name_key" ON "EmailTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSender_email_key" ON "EmailSender"("email");

-- CreateIndex
CREATE INDEX "Lead_emailStatus_idx" ON "Lead"("emailStatus");

-- CreateIndex
CREATE INDEX "Lead_emailScheduledAt_idx" ON "Lead"("emailScheduledAt");

-- CreateIndex
CREATE INDEX "Lead_verificationStatus_idx" ON "Lead"("verificationStatus");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_emailTemplateId_fkey" FOREIGN KEY ("emailTemplateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_emailSenderId_fkey" FOREIGN KEY ("emailSenderId") REFERENCES "EmailSender"("id") ON DELETE SET NULL ON UPDATE CASCADE;
