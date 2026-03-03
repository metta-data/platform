-- CreateEnum
CREATE TYPE "SnapshotSourceType" AS ENUM ('INGESTION', 'UPLOAD_JSON', 'UPLOAD_CSV');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('PENDING', 'INGESTING_TABLES', 'INGESTING_COLUMNS', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "servicenow_instances" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "encrypted_password" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicenow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_snapshots" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "version" TEXT,
    "description" TEXT,
    "instance_id" TEXT,
    "source_type" "SnapshotSourceType" NOT NULL DEFAULT 'INGESTION',
    "status" "SnapshotStatus" NOT NULL DEFAULT 'PENDING',
    "table_count" INTEGER NOT NULL DEFAULT 0,
    "column_count" INTEGER NOT NULL DEFAULT 0,
    "ingest_started_at" TIMESTAMP(3),
    "ingest_completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "is_baseline" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schema_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snapshot_tables" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "sys_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "super_class_name" TEXT,
    "scope_name" TEXT,
    "scope_label" TEXT,
    "is_extendable" BOOLEAN NOT NULL DEFAULT true,
    "accessible_from" TEXT,
    "number_prefix" TEXT,
    "own_column_count" INTEGER NOT NULL DEFAULT 0,
    "total_column_count" INTEGER NOT NULL DEFAULT 0,
    "child_table_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "snapshot_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snapshot_columns" (
    "id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "sys_id" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "defined_on_table" TEXT NOT NULL,
    "internal_type" TEXT NOT NULL,
    "reference_table" TEXT,
    "max_length" INTEGER,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "is_read_only" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_display" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "default_value" TEXT,
    "attributes" JSONB DEFAULT '{}',

    CONSTRAINT "snapshot_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashed_password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schema_snapshots_label_idx" ON "schema_snapshots"("label");

-- CreateIndex
CREATE INDEX "schema_snapshots_is_baseline_idx" ON "schema_snapshots"("is_baseline");

-- CreateIndex
CREATE INDEX "snapshot_tables_snapshot_id_idx" ON "snapshot_tables"("snapshot_id");

-- CreateIndex
CREATE INDEX "snapshot_tables_super_class_name_idx" ON "snapshot_tables"("super_class_name");

-- CreateIndex
CREATE INDEX "snapshot_tables_scope_name_idx" ON "snapshot_tables"("scope_name");

-- CreateIndex
CREATE INDEX "snapshot_tables_name_idx" ON "snapshot_tables"("name");

-- CreateIndex
CREATE UNIQUE INDEX "snapshot_tables_snapshot_id_name_key" ON "snapshot_tables"("snapshot_id", "name");

-- CreateIndex
CREATE INDEX "snapshot_columns_table_id_idx" ON "snapshot_columns"("table_id");

-- CreateIndex
CREATE INDEX "snapshot_columns_defined_on_table_idx" ON "snapshot_columns"("defined_on_table");

-- CreateIndex
CREATE INDEX "snapshot_columns_element_idx" ON "snapshot_columns"("element");

-- CreateIndex
CREATE INDEX "snapshot_columns_internal_type_idx" ON "snapshot_columns"("internal_type");

-- CreateIndex
CREATE UNIQUE INDEX "snapshot_columns_table_id_element_key" ON "snapshot_columns"("table_id", "element");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- AddForeignKey
ALTER TABLE "schema_snapshots" ADD CONSTRAINT "schema_snapshots_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "servicenow_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshot_tables" ADD CONSTRAINT "snapshot_tables_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "schema_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshot_columns" ADD CONSTRAINT "snapshot_columns_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "snapshot_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
