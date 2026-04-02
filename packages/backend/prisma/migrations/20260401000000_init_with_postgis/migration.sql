-- IRM Initial Migration with PostGIS Support
-- Extensions are managed via docker/postgres/init.sql, but we reference them here for completeness

-- ─── Nummernkreis-Sequenzen ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "number_sequences" (
    "year"        INTEGER NOT NULL,
    "type_digit"  INTEGER NOT NULL,
    "last_number" BIGINT  NOT NULL DEFAULT 0,
    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("year", "type_digit")
);

CREATE TABLE IF NOT EXISTS "master_data_sequences" (
    "prefix"      VARCHAR(20) NOT NULL,
    "last_number" BIGINT      NOT NULL DEFAULT 0,
    CONSTRAINT "master_data_sequences_pkey" PRIMARY KEY ("prefix")
);

-- ─── Kunden ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "customers" (
    "id"             UUID         NOT NULL DEFAULT uuid_generate_v4(),
    "customer_number" VARCHAR(20) NOT NULL,
    "company_name"   VARCHAR(255) NOT NULL,
    "is_company"     BOOLEAN      NOT NULL DEFAULT TRUE,
    "address_street" VARCHAR(255),
    "address_zip"    VARCHAR(10),
    "address_city"   VARCHAR(100),
    "address_country" CHAR(2)     NOT NULL DEFAULT 'DE',
    "phone"          VARCHAR(50),
    "email"          VARCHAR(255),
    "contact_person" VARCHAR(255),
    "notes"          TEXT,
    "is_internal"    BOOLEAN      NOT NULL DEFAULT FALSE,
    "is_active"      BOOLEAN      NOT NULL DEFAULT TRUE,
    "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "customers_customer_number_key" ON "customers" ("customer_number");

-- ─── Immobilien ──────────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS "PropertyType" AS ENUM (
    'RESIDENTIAL', 'COMMERCIAL', 'MIXED', 'LAND', 'PARKING'
);

CREATE TABLE IF NOT EXISTS "properties" (
    "id"              UUID          NOT NULL DEFAULT uuid_generate_v4(),
    "property_number" VARCHAR(20)   NOT NULL,
    "customer_id"     UUID          NOT NULL,
    "name"            VARCHAR(255)  NOT NULL,
    "address_street"  VARCHAR(255)  NOT NULL,
    "address_zip"     VARCHAR(10)   NOT NULL,
    "address_city"    VARCHAR(100)  NOT NULL,
    "latitude"        DECIMAL(10,7),
    "longitude"       DECIMAL(10,7),
    "geo_point"       GEOMETRY(Point, 4326),  -- PostGIS!
    "property_type"   "PropertyType" NOT NULL DEFAULT 'RESIDENTIAL',
    "total_area_sqm"  DECIMAL(10,2),
    "green_area_sqm"  DECIMAL(10,2),
    "floors"          INTEGER       NOT NULL DEFAULT 1,
    "units_count"     INTEGER       NOT NULL DEFAULT 0,
    "notes"           TEXT,
    "is_active"       BOOLEAN       NOT NULL DEFAULT TRUE,
    "metadata"        JSONB,
    "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT "properties_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "properties_customer_id_fkey" FOREIGN KEY ("customer_id")
        REFERENCES "customers" ("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "properties_property_number_key" ON "properties" ("property_number");
-- Spatial index for PostGIS distance queries
CREATE INDEX IF NOT EXISTS "properties_geo_point_idx" ON "properties" USING GIST ("geo_point");

-- ─── Immobilien-Einheiten ────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS "UnitUsageType" AS ENUM (
    'RESIDENTIAL', 'COMMERCIAL', 'COMMON_AREA', 'TECHNICAL'
);

CREATE TABLE IF NOT EXISTS "property_units" (
    "id"          UUID         NOT NULL DEFAULT uuid_generate_v4(),
    "property_id" UUID         NOT NULL,
    "unit_number" VARCHAR(20)  NOT NULL,
    "floor"       VARCHAR(20)  NOT NULL,
    "tenant_name" VARCHAR(255),
    "tenant_phone" VARCHAR(50),
    "usage_type"  "UnitUsageType" NOT NULL DEFAULT 'RESIDENTIAL',
    "area_sqm"    DECIMAL(10,2),
    "notes"       TEXT,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "property_units_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "property_units_property_id_fkey" FOREIGN KEY ("property_id")
        REFERENCES "properties" ("id") ON DELETE CASCADE
);

-- ─── Personal ────────────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS "EmploymentType" AS ENUM (
    'FULL_TIME', 'PART_TIME', 'MINI_JOB', 'FREELANCER'
);

CREATE TABLE IF NOT EXISTS "staff" (
    "id"              UUID          NOT NULL DEFAULT uuid_generate_v4(),
    "staff_number"    VARCHAR(20)   NOT NULL,
    "first_name"      VARCHAR(100)  NOT NULL,
    "last_name"       VARCHAR(100)  NOT NULL,
    "email"           VARCHAR(255)  UNIQUE,
    "phone"           VARCHAR(50),
    "mobile"          VARCHAR(50),
    "address"         TEXT,
    "latitude"        DECIMAL(10,7),
    "longitude"       DECIMAL(10,7),
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "weekly_hours"    DECIMAL(5,2),
    "color"           CHAR(7)       NOT NULL DEFAULT '#3B82F6',
    "is_active"       BOOLEAN       NOT NULL DEFAULT TRUE,
    "user_id"         UUID,
    "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_staff_number_key" ON "staff" ("staff_number");

-- ─── Fähigkeiten ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "skills" (
    "id"                    UUID         NOT NULL DEFAULT uuid_generate_v4(),
    "name"                  VARCHAR(100) NOT NULL,
    "category"              VARCHAR(100) NOT NULL,
    "description"           TEXT,
    "requires_certification" BOOLEAN     NOT NULL DEFAULT FALSE,
    "icon"                  VARCHAR(50)  NOT NULL DEFAULT 'Star',
    "created_at"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "skills_name_key" ON "skills" ("name");

CREATE TYPE IF NOT EXISTS "SkillLevel" AS ENUM ('BASIC', 'INTERMEDIATE', 'EXPERT');

CREATE TABLE IF NOT EXISTS "staff_skills" (
    "staff_id"        UUID         NOT NULL,
    "skill_id"        UUID         NOT NULL,
    "level"           "SkillLevel"  NOT NULL DEFAULT 'BASIC',
    "certified_until" DATE,
    "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "staff_skills_pkey" PRIMARY KEY ("staff_id", "skill_id"),
    CONSTRAINT "staff_skills_staff_id_fkey" FOREIGN KEY ("staff_id")
        REFERENCES "staff" ("id") ON DELETE CASCADE,
    CONSTRAINT "staff_skills_skill_id_fkey" FOREIGN KEY ("skill_id")
        REFERENCES "skills" ("id") ON DELETE RESTRICT
);

-- ─── Maschinen & KFZ ─────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS "EquipmentCategory" AS ENUM ('MACHINE', 'VEHICLE', 'TOOL', 'MATERIAL');
CREATE TYPE IF NOT EXISTS "EquipmentStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'BROKEN');

CREATE TABLE IF NOT EXISTS "equipment" (
    "id"                   UUID                NOT NULL DEFAULT uuid_generate_v4(),
    "equipment_number"     VARCHAR(20)         NOT NULL,
    "name"                 VARCHAR(255)        NOT NULL,
    "category"             "EquipmentCategory" NOT NULL,
    "equipment_type"       VARCHAR(100)        NOT NULL,
    "license_plate"        VARCHAR(20),
    "requires_license"     BOOLEAN             NOT NULL DEFAULT FALSE,
    "required_license_type" VARCHAR(10),
    "location"             VARCHAR(255),
    "status"               "EquipmentStatus"   NOT NULL DEFAULT 'AVAILABLE',
    "next_maintenance"     DATE,
    "notes"                TEXT,
    "created_at"           TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    "updated_at"           TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "equipment_equipment_number_key" ON "equipment" ("equipment_number");

-- ─── Tätigkeitskatalog ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "activity_types" (
    "id"                   UUID         NOT NULL DEFAULT uuid_generate_v4(),
    "code"                 VARCHAR(50)  NOT NULL,
    "name"                 VARCHAR(255) NOT NULL,
    "category"             VARCHAR(100) NOT NULL,
    "description"          TEXT,
    "default_duration_min" INTEGER      NOT NULL DEFAULT 60,
    "is_recurring"         BOOLEAN      NOT NULL DEFAULT FALSE,
    "recurrence_interval"  VARCHAR(20),
    "season_start"         SMALLINT,
    "season_end"           SMALLINT,
    "icon"                 VARCHAR(50)  NOT NULL DEFAULT 'ClipboardList',
    "color"                CHAR(7)      NOT NULL DEFAULT '#6B7280',
    "is_active"            BOOLEAN      NOT NULL DEFAULT TRUE,
    "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "activity_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "activity_types_code_key" ON "activity_types" ("code");

-- Many-to-Many: ActivityType <-> Skill
CREATE TABLE IF NOT EXISTS "_ActivityTypeToSkill" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,
    CONSTRAINT "_ActivityTypeToSkill_AB_pkey" PRIMARY KEY ("A", "B"),
    CONSTRAINT "_ActivityTypeToSkill_A_fkey" FOREIGN KEY ("A")
        REFERENCES "activity_types" ("id") ON DELETE CASCADE,
    CONSTRAINT "_ActivityTypeToSkill_B_fkey" FOREIGN KEY ("B")
        REFERENCES "skills" ("id") ON DELETE CASCADE
);

-- Many-to-Many: ActivityType <-> Equipment (default)
CREATE TABLE IF NOT EXISTS "_ActivityTypeToEquipment" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,
    CONSTRAINT "_ActivityTypeToEquipment_AB_pkey" PRIMARY KEY ("A", "B"),
    CONSTRAINT "_ActivityTypeToEquipment_A_fkey" FOREIGN KEY ("A")
        REFERENCES "activity_types" ("id") ON DELETE CASCADE,
    CONSTRAINT "_ActivityTypeToEquipment_B_fkey" FOREIGN KEY ("B")
        REFERENCES "equipment" ("id") ON DELETE CASCADE
);

-- ─── Zeitformeln ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "time_formulas" (
    "id"               UUID         NOT NULL DEFAULT uuid_generate_v4(),
    "name"             VARCHAR(255) NOT NULL,
    "activity_type_id" UUID         NOT NULL,
    "formula"          JSONB        NOT NULL,
    "variables"        JSONB        NOT NULL,
    "default_values"   JSONB,
    "result_unit"      VARCHAR(20)  NOT NULL DEFAULT 'minutes',
    "description"      TEXT,
    "version"          INTEGER      NOT NULL DEFAULT 1,
    "is_active"        BOOLEAN      NOT NULL DEFAULT TRUE,
    "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "time_formulas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "time_formulas_activity_type_id_fkey" FOREIGN KEY ("activity_type_id")
        REFERENCES "activity_types" ("id") ON DELETE RESTRICT
);

-- ─── Abwesenheiten ───────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS "AbsenceType" AS ENUM ('VACATION', 'SICK', 'TRAINING', 'PERSONAL', 'COMP_TIME');
CREATE TYPE IF NOT EXISTS "AbsenceStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "absences" (
    "id"          UUID           NOT NULL DEFAULT uuid_generate_v4(),
    "staff_id"    UUID           NOT NULL,
    "type"        "AbsenceType"  NOT NULL,
    "start_date"  DATE           NOT NULL,
    "end_date"    DATE           NOT NULL,
    "status"      "AbsenceStatus" NOT NULL DEFAULT 'REQUESTED',
    "approved_by" UUID,
    "notes"       TEXT,
    "created_at"  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    "updated_at"  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT "absences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "absences_staff_id_fkey" FOREIGN KEY ("staff_id")
        REFERENCES "staff" ("id") ON DELETE RESTRICT,
    -- Überschneidungscheck via btree_gist
    CONSTRAINT "absences_no_overlap" EXCLUDE USING GIST (
        "staff_id" WITH =,
        daterange("start_date", "end_date", '[]') WITH &&
    ) WHERE (status NOT IN ('REJECTED', 'CANCELLED'))
);

-- ─── Aufträge ────────────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS "WorkOrderStatus" AS ENUM (
    'DRAFT', 'PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
);
CREATE TYPE IF NOT EXISTS "WorkOrderPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE IF NOT EXISTS "work_orders" (
    "id"                   UUID                NOT NULL DEFAULT uuid_generate_v4(),
    "order_number"         VARCHAR(20)         NOT NULL,
    "property_id"          UUID                NOT NULL,
    "customer_id"          UUID                NOT NULL,
    "activity_type_id"     UUID                NOT NULL,
    "title"                VARCHAR(255)        NOT NULL,
    "description"          TEXT,
    "status"               "WorkOrderStatus"   NOT NULL DEFAULT 'DRAFT',
    "priority"             "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
    "planned_date"         DATE,
    "planned_start_time"   TIME,
    "planned_duration_min" INTEGER,
    "actual_start"         TIMESTAMPTZ,
    "actual_end"           TIMESTAMPTZ,
    "actual_duration_min"  INTEGER,
    "assigned_staff"       UUID[]              NOT NULL DEFAULT '{}',
    "assigned_equipment"   UUID[]              NOT NULL DEFAULT '{}',
    "calculation_params"   JSONB,
    "previous_order_id"    UUID,
    "previous_duration_min" INTEGER,
    "notes"                TEXT,
    "completion_notes"     TEXT,
    "created_by"           UUID                NOT NULL,
    "created_at"           TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    "updated_at"           TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "work_orders_property_id_fkey" FOREIGN KEY ("property_id")
        REFERENCES "properties" ("id") ON DELETE RESTRICT,
    CONSTRAINT "work_orders_customer_id_fkey" FOREIGN KEY ("customer_id")
        REFERENCES "customers" ("id") ON DELETE RESTRICT,
    CONSTRAINT "work_orders_activity_type_id_fkey" FOREIGN KEY ("activity_type_id")
        REFERENCES "activity_types" ("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "work_orders_order_number_key" ON "work_orders" ("order_number");
-- Index für Abfragen nach Datum + Status (häufige Scheduling-Queries)
CREATE INDEX IF NOT EXISTS "work_orders_planned_date_status_idx" ON "work_orders" ("planned_date", "status");
-- Index für "alle Aufträge an Immobilie" Query
CREATE INDEX IF NOT EXISTS "work_orders_property_id_idx" ON "work_orders" ("property_id");
-- GIN-Index für Array-Spalten (assigned_staff suche)
CREATE INDEX IF NOT EXISTS "work_orders_assigned_staff_idx" ON "work_orders" USING GIN ("assigned_staff");

-- ─── Auftrags-Material ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "work_order_equipment" (
    "id"            UUID        NOT NULL DEFAULT uuid_generate_v4(),
    "work_order_id" UUID        NOT NULL,
    "equipment_id"  UUID        NOT NULL,
    "quantity"      INTEGER     NOT NULL DEFAULT 1,
    "is_checked_out" BOOLEAN    NOT NULL DEFAULT FALSE,
    "notes"         VARCHAR(255),
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "work_order_equipment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "work_order_equipment_work_order_id_fkey" FOREIGN KEY ("work_order_id")
        REFERENCES "work_orders" ("id") ON DELETE CASCADE,
    CONSTRAINT "work_order_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id")
        REFERENCES "equipment" ("id") ON DELETE RESTRICT
);

-- ─── Laufzettel ──────────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS "RouteSheetStatus" AS ENUM ('DRAFT', 'ISSUED', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE IF NOT EXISTS "route_sheets" (
    "id"               UUID               NOT NULL DEFAULT uuid_generate_v4(),
    "sheet_number"     VARCHAR(20)        NOT NULL,
    "staff_id"         UUID               NOT NULL,
    "vehicle_id"       UUID,
    "date"             DATE               NOT NULL,
    "status"           "RouteSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "total_duration_min" INTEGER,
    "total_distance_km" DECIMAL(8,2),
    "pdf_path"         VARCHAR(500),
    "created_at"       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    "updated_at"       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    CONSTRAINT "route_sheets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "route_sheets_sheet_number_key" ON "route_sheets" ("sheet_number");

CREATE TABLE IF NOT EXISTS "route_sheet_items" (
    "id"             UUID        NOT NULL DEFAULT uuid_generate_v4(),
    "route_sheet_id" UUID        NOT NULL,
    "work_order_id"  UUID        NOT NULL,
    "position"       INTEGER     NOT NULL,
    "travel_time_min" INTEGER,
    "distance_km"    DECIMAL(8,2),
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "route_sheet_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "route_sheet_items_route_sheet_id_fkey" FOREIGN KEY ("route_sheet_id")
        REFERENCES "route_sheets" ("id") ON DELETE CASCADE,
    CONSTRAINT "route_sheet_items_work_order_id_fkey" FOREIGN KEY ("work_order_id")
        REFERENCES "work_orders" ("id") ON DELETE RESTRICT
);

-- ─── Updated-At Trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'customers', 'properties', 'property_units', 'staff',
        'skills', 'equipment', 'activity_types', 'time_formulas',
        'absences', 'work_orders', 'route_sheets'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER update_%s_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            tbl, tbl
        );
    END LOOP;
END;
$$;
