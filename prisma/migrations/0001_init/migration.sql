-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'BROKER', 'VIEWER');

-- CreateEnum
CREATE TYPE "RecordType" AS ENUM ('completed_transaction', 'active_listing', 'historical_listing');

-- CreateEnum
CREATE TYPE "ValuationStatus" AS ENUM ('draft', 'completed', 'insufficient_data');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'BROKER',
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_records" (
    "id" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "source_url" TEXT,
    "source_record_id" TEXT NOT NULL,
    "record_type" "RecordType" NOT NULL,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "transaction_date" TIMESTAMP(3),
    "listing_date" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "city" TEXT NOT NULL,
    "neighborhood" TEXT,
    "street" TEXT,
    "house_number" TEXT,
    "address" TEXT,
    "block" TEXT,
    "parcel" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "property_type" TEXT,
    "rooms" DOUBLE PRECISION,
    "area_sqm" DOUBLE PRECISION,
    "floor" INTEGER,
    "building_floors" INTEGER,
    "elevator" BOOLEAN,
    "balcony" BOOLEAN,
    "balcony_area_sqm" DOUBLE PRECISION,
    "parking_spaces" INTEGER,
    "storage" BOOLEAN,
    "mamad" BOOLEAN,
    "condition" TEXT,
    "building_year" INTEGER,
    "transaction_price_ils" INTEGER,
    "asking_price_ils" INTEGER,
    "data_confidence" DOUBLE PRECISION,
    "last_verified_at" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_data" JSONB,

    CONSTRAINT "property_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "priceIls" INTEGER NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valuations" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ValuationStatus" NOT NULL DEFAULT 'draft',
    "input" JSONB NOT NULL,
    "result" JSONB,
    "algorithmVersion" TEXT,
    "aiSummary" TEXT,
    "aiProvider" TEXT,
    "brokerNotes" TEXT,
    "sourcesUsed" JSONB,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valuation_comparables" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "distanceM" DOUBLE PRECISION,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "reasons" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "valuation_comparables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_runs" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "recordsFetched" INTEGER NOT NULL DEFAULT 0,
    "recordsNew" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,

    CONSTRAINT "connector_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "property_records_city_neighborhood_idx" ON "property_records"("city", "neighborhood");

-- CreateIndex
CREATE INDEX "property_records_city_street_idx" ON "property_records"("city", "street");

-- CreateIndex
CREATE INDEX "property_records_record_type_transaction_date_idx" ON "property_records"("record_type", "transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "property_records_source_name_source_record_id_key" ON "property_records"("source_name", "source_record_id");

-- CreateIndex
CREATE INDEX "price_history_recordId_observedAt_idx" ON "price_history"("recordId", "observedAt");

-- CreateIndex
CREATE INDEX "valuations_accountId_createdAt_idx" ON "valuations"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "valuation_comparables_valuationId_idx" ON "valuation_comparables"("valuationId");

-- CreateIndex
CREATE INDEX "connector_runs_connectorId_startedAt_idx" ON "connector_runs"("connectorId", "startedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "property_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "valuations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuation_comparables" ADD CONSTRAINT "valuation_comparables_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "valuations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuation_comparables" ADD CONSTRAINT "valuation_comparables_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "property_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

