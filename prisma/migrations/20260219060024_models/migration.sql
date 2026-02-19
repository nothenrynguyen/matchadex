/*
  Warnings:

  - The primary key for the `Cafe` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Review` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `aesthetic` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the column `study` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the column `taste` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `Review` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `bio` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `googleId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isAdmin` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[googlePlaceId]` on the table `Cafe` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `googlePlaceId` to the `Cafe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `aestheticRating` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studyRating` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tasteRating` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_cafeId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_userId_fkey";

-- DropIndex
DROP INDEX "User_googleId_key";

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "Cafe" DROP CONSTRAINT "Cafe_pkey",
ADD COLUMN     "googlePlaceId" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Cafe_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Cafe_id_seq";

-- AlterTable
ALTER TABLE "Review" DROP CONSTRAINT "Review_pkey",
DROP COLUMN "aesthetic",
DROP COLUMN "price",
DROP COLUMN "study",
DROP COLUMN "taste",
DROP COLUMN "text",
ADD COLUMN     "aestheticRating" INTEGER NOT NULL,
ADD COLUMN     "priceEstimate" DOUBLE PRECISION,
ADD COLUMN     "studyRating" INTEGER NOT NULL,
ADD COLUMN     "tasteRating" INTEGER NOT NULL,
ADD COLUMN     "textComment" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "cafeId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Review_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Review_id_seq";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "bio",
DROP COLUMN "googleId",
DROP COLUMN "isAdmin",
DROP COLUMN "username",
ADD COLUMN     "email" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- CreateIndex
CREATE UNIQUE INDEX "Cafe_googlePlaceId_key" ON "Cafe"("googlePlaceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "Cafe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
