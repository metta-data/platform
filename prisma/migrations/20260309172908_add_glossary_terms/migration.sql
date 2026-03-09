-- CreateTable
CREATE TABLE "glossary_terms" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "category" TEXT,
    "related_tables" TEXT[],
    "csdm_domain_id" TEXT,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "glossary_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "glossary_terms_term_key" ON "glossary_terms"("term");

-- CreateIndex
CREATE INDEX "glossary_terms_category_idx" ON "glossary_terms"("category");

-- CreateIndex
CREATE INDEX "glossary_terms_csdm_domain_id_idx" ON "glossary_terms"("csdm_domain_id");

-- AddForeignKey
ALTER TABLE "glossary_terms" ADD CONSTRAINT "glossary_terms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glossary_terms" ADD CONSTRAINT "glossary_terms_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
