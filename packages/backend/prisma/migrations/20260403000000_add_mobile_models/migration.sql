-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('MOBILE', 'WEB', 'MANUAL');

-- CreateTable
CREATE TABLE "work_order_photos" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "work_order_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "caption" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "taken_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "work_order_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_min" INTEGER,
    "notes" TEXT,
    "source" "TimeEntrySource" NOT NULL DEFAULT 'MOBILE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "work_order_photos" ADD CONSTRAINT "work_order_photos_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex (Optimierung für häufige Abfragen)
CREATE INDEX "work_order_photos_work_order_id_idx" ON "work_order_photos"("work_order_id");
CREATE INDEX "time_entries_work_order_id_idx" ON "time_entries"("work_order_id");
CREATE INDEX "time_entries_staff_id_idx" ON "time_entries"("staff_id");
