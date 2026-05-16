-- Add AI settings persistence for authenticated users
ALTER TABLE "UserState" ADD COLUMN "aiSettings" JSONB;
