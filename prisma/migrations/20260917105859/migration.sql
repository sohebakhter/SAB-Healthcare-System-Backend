/*
  Warnings:

  - You are about to drop the column `availableStols` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `totalStols` on the `schedules` table. All the data in the column will be lost.
  - Added the required column `availableSlots` to the `schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalSlots` to the `schedules` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "schedules" DROP COLUMN "availableStols",
DROP COLUMN "totalStols",
ADD COLUMN     "availableSlots" INTEGER NOT NULL,
ADD COLUMN     "totalSlots" INTEGER NOT NULL;
