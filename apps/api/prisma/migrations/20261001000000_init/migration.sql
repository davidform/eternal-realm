-- CreateEnum
CREATE TYPE "CharacterClass" AS ENUM ('KNIGHT', 'ELF', 'MAGE', 'DARK_ELF');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "is_guest" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "class" "CharacterClass" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" BIGINT NOT NULL DEFAULT 0,
    "prestige_rank" INTEGER NOT NULL DEFAULT 0,
    "gold" BIGINT NOT NULL DEFAULT 0,
    "current_hp" INTEGER NOT NULL,
    "current_mp" INTEGER NOT NULL,
    "position_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "zone_id" TEXT NOT NULL DEFAULT 'training-ground',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_stats" (
    "character_id" UUID NOT NULL,
    "strength" INTEGER NOT NULL,
    "dexterity" INTEGER NOT NULL,
    "constitution" INTEGER NOT NULL,
    "intelligence" INTEGER NOT NULL,
    "wisdom" INTEGER NOT NULL,
    "luck" INTEGER NOT NULL,

    CONSTRAINT "character_stats_pkey" PRIMARY KEY ("character_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "characters_user_id_idx" ON "characters"("user_id");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_stats" ADD CONSTRAINT "character_stats_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
