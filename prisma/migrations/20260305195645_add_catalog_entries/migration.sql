-- CreateTable
CREATE TABLE "catalog_entries" (
    "id" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "internal_type" TEXT NOT NULL,
    "definition" TEXT,
    "steward_id" TEXT,
    "source_snapshot_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_entry_snapshots" (
    "id" TEXT NOT NULL,
    "catalog_entry_id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_entry_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_entries_table_name_idx" ON "catalog_entries"("table_name");

-- CreateIndex
CREATE INDEX "catalog_entries_element_idx" ON "catalog_entries"("element");

-- CreateIndex
CREATE INDEX "catalog_entries_steward_id_idx" ON "catalog_entries"("steward_id");

-- CreateIndex
CREATE INDEX "catalog_entries_source_snapshot_id_idx" ON "catalog_entries"("source_snapshot_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_entries_table_name_element_key" ON "catalog_entries"("table_name", "element");

-- CreateIndex
CREATE INDEX "catalog_entry_snapshots_catalog_entry_id_idx" ON "catalog_entry_snapshots"("catalog_entry_id");

-- CreateIndex
CREATE INDEX "catalog_entry_snapshots_snapshot_id_idx" ON "catalog_entry_snapshots"("snapshot_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_entry_snapshots_catalog_entry_id_snapshot_id_key" ON "catalog_entry_snapshots"("catalog_entry_id", "snapshot_id");

-- AddForeignKey
ALTER TABLE "catalog_entries" ADD CONSTRAINT "catalog_entries_steward_id_fkey" FOREIGN KEY ("steward_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_entries" ADD CONSTRAINT "catalog_entries_source_snapshot_id_fkey" FOREIGN KEY ("source_snapshot_id") REFERENCES "schema_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_entry_snapshots" ADD CONSTRAINT "catalog_entry_snapshots_catalog_entry_id_fkey" FOREIGN KEY ("catalog_entry_id") REFERENCES "catalog_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_entry_snapshots" ADD CONSTRAINT "catalog_entry_snapshots_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "schema_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
