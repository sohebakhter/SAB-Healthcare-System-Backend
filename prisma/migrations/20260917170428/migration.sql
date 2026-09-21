/*
  Warnings:

  - You are about to drop the column `endDataTime` on the `schedules` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[doctorId,startDateTime,endDateTime]` on the table `schedules` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `endDateTime` to the `schedules` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "schedules_doctorId_startDateTime_endDataTime_key";

-- AlterTable
ALTER TABLE "schedules" DROP COLUMN "endDataTime",
ADD COLUMN     "endDateTime" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "schedules_doctorId_startDateTime_endDateTime_key" ON "schedules"("doctorId", "startDateTime", "endDateTime");
