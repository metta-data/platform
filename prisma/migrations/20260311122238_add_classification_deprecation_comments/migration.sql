-- AlterTable
ALTER TABLE "catalog_entries" ADD COLUMN     "deprecated_at" TIMESTAMP(3),
ADD COLUMN     "deprecated_by_id" TEXT,
ADD COLUMN     "deprecation_note" TEXT,
ADD COLUMN     "is_deprecated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "superseded_by_id" TEXT;

-- CreateTable
CREATE TABLE "classification_levels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "severity" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classification_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_entry_classifications" (
    "id" TEXT NOT NULL,
    "catalog_entry_id" TEXT NOT NULL,
    "classification_level_id" TEXT NOT NULL,
    "classified_by_id" TEXT NOT NULL,
    "justification" TEXT,
    "classified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_entry_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_comments" (
    "id" TEXT NOT NULL,
    "catalog_entry_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classification_levels_name_key" ON "classification_levels"("name");

-- CreateIndex
CREATE INDEX "classification_levels_severity_idx" ON "classification_levels"("severity");

-- CreateIndex
CREATE INDEX "catalog_entry_classifications_catalog_entry_id_idx" ON "catalog_entry_classifications"("catalog_entry_id");

-- CreateIndex
CREATE INDEX "catalog_entry_classifications_classification_level_id_idx" ON "catalog_entry_classifications"("classification_level_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_entry_classifications_catalog_entry_id_classificati_key" ON "catalog_entry_classifications"("catalog_entry_id", "classification_level_id");

-- CreateIndex
CREATE INDEX "catalog_comments_catalog_entry_id_idx" ON "catalog_comments"("catalog_entry_id");

-- CreateIndex
CREATE INDEX "catalog_comments_parent_id_idx" ON "catalog_comments"("parent_id");

-- CreateIndex
CREATE INDEX "catalog_comments_author_id_idx" ON "catalog_comments"("author_id");

-- CreateIndex
CREATE INDEX "catalog_entries_is_deprecated_idx" ON "catalog_entries"("is_deprecated");

-- AddForeignKey
ALTER TABLE "catalog_entries" ADD CONSTRAINT "catalog_entries_deprecated_by_id_fkey" FOREIGN KEY ("deprecated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_entries" ADD CONSTRAINT "catalog_entries_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "catalog_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_entry_classifications" ADD CONSTRAINT "catalog_entry_classifications_catalog_entry_id_fkey" FOREIGN KEY ("catalog_entry_id") REFERENCES "catalog_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_entry_classifications" ADD CONSTRAINT "catalog_entry_classifications_classification_level_id_fkey" FOREIGN KEY ("classification_level_id") REFERENCES "classification_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_entry_classifications" ADD CONSTRAINT "catalog_entry_classifications_classified_by_id_fkey" FOREIGN KEY ("classified_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_comments" ADD CONSTRAINT "catalog_comments_catalog_entry_id_fkey" FOREIGN KEY ("catalog_entry_id") REFERENCES "catalog_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_comments" ADD CONSTRAINT "catalog_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_comments" ADD CONSTRAINT "catalog_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_comments" ADD CONSTRAINT "catalog_comments_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default classification levels
INSERT INTO classification_levels (id, name, description, color, severity, is_system, created_at, updated_at) VALUES
  ('clsf_public',       'Public',       'Data intended for public access',                '#3A9A68', 0, true, NOW(), NOW()),
  ('clsf_internal',     'Internal',     'Data for internal organizational use',           '#3878E0', 1, true, NOW(), NOW()),
  ('clsf_confidential', 'Confidential', 'Sensitive business data with restricted access', '#C88020', 2, true, NOW(), NOW()),
  ('clsf_pii',          'PII',          'Personally Identifiable Information',            '#D42828', 3, true, NOW(), NOW()),
  ('clsf_phi',          'PHI',          'Protected Health Information (HIPAA)',            '#C01828', 4, true, NOW(), NOW()),
  ('clsf_pci',          'PCI',          'Payment Card Industry data (PCI-DSS)',           '#C01828', 4, true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
