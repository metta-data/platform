-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('AUTO', 'USER');

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "tag_type" "TagType" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_entry_tags" (
    "id" TEXT NOT NULL,
    "catalog_entry_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_entry_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "tags_tag_type_idx" ON "tags"("tag_type");

-- CreateIndex
CREATE INDEX "catalog_entry_tags_catalog_entry_id_idx" ON "catalog_entry_tags"("catalog_entry_id");

-- CreateIndex
CREATE INDEX "catalog_entry_tags_tag_id_idx" ON "catalog_entry_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_entry_tags_catalog_entry_id_tag_id_key" ON "catalog_entry_tags"("catalog_entry_id", "tag_id");

-- AddForeignKey
ALTER TABLE "catalog_entry_tags" ADD CONSTRAINT "catalog_entry_tags_catalog_entry_id_fkey" FOREIGN KEY ("catalog_entry_id") REFERENCES "catalog_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_entry_tags" ADD CONSTRAINT "catalog_entry_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
