-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL DEFAULT 'org',
    "name" TEXT NOT NULL DEFAULT 'SquareFeets Realty',
    "rera" TEXT NOT NULL DEFAULT '',
    "gstin" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT 'Kolkata',
    "state" TEXT NOT NULL DEFAULT 'West Bengal',
    "country" TEXT NOT NULL DEFAULT 'India',
    "bank" TEXT NOT NULL DEFAULT '',
    "persona" TEXT NOT NULL DEFAULT 'mixed',
    "notif" JSONB NOT NULL DEFAULT '{}',
    "perms" JSONB NOT NULL DEFAULT '{}',
    "masters" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Agent',
    "email" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "corpPhone" TEXT NOT NULL DEFAULT '',
    "altPhone" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "seeNumbers" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "n" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Amenity" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cat" TEXT NOT NULL,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "dev" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'Residential Complex',
    "rera" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'uc',
    "cm" TEXT NOT NULL DEFAULT '',
    "cy" TEXT NOT NULL DEFAULT '',
    "complete" TEXT NOT NULL DEFAULT '',
    "size" TEXT NOT NULL DEFAULT '',
    "sizeUnit" TEXT NOT NULL DEFAULT '',
    "towers" TEXT NOT NULL DEFAULT '',
    "units" TEXT NOT NULL DEFAULT '',
    "configs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sale" BOOLEAN NOT NULL DEFAULT true,
    "rent" BOOLEAN NOT NULL DEFAULT true,
    "saleFrom" TEXT NOT NULL DEFAULT '',
    "saleTo" TEXT NOT NULL DEFAULT '',
    "rentFrom" TEXT NOT NULL DEFAULT '',
    "rentTo" TEXT NOT NULL DEFAULT '',
    "place" JSONB,
    "addr" JSONB NOT NULL DEFAULT '{}',
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customAmen" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brochure" TEXT NOT NULL DEFAULT '',
    "layouts" JSONB NOT NULL DEFAULT '[]',
    "charges" JSONB NOT NULL DEFAULT '[]',
    "photos" JSONB NOT NULL DEFAULT '[]',
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "cat" TEXT NOT NULL DEFAULT '',
    "sub" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "projectId" TEXT,
    "unit" TEXT NOT NULL DEFAULT '',
    "loc" TEXT NOT NULL DEFAULT '',
    "bhk" INTEGER NOT NULL DEFAULT 0,
    "area" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "furn" TEXT NOT NULL DEFAULT '',
    "priceL" DOUBLE PRECISION,
    "quotedL" DOUBLE PRECISION,
    "rentK" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "source" TEXT NOT NULL DEFAULT 'Owner',
    "owner" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'Direct Reference',
    "intent" TEXT NOT NULL DEFAULT 'buy',
    "stage" TEXT NOT NULL DEFAULT 'Lead',
    "sub" TEXT NOT NULL DEFAULT '',
    "budget" TEXT NOT NULL DEFAULT '',
    "want" TEXT NOT NULL DEFAULT '',
    "assigned" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "act" JSONB NOT NULL DEFAULT '[]',
    "links" JSONB NOT NULL DEFAULT '[]',
    "basic" JSONB NOT NULL DEFAULT '{}',
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'Buyer',
    "nri" BOOLEAN NOT NULL DEFAULT false,
    "city" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "assigned" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "lang" TEXT NOT NULL DEFAULT 'English',
    "notes" TEXT NOT NULL DEFAULT '',
    "waOk" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "cid" TEXT NOT NULL DEFAULT '',
    "purpose" TEXT NOT NULL DEFAULT 'sale',
    "type" TEXT NOT NULL DEFAULT 'Apartment / Flat',
    "locs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "min" DOUBLE PRECISION,
    "max" DOUBLE PRECISION,
    "bhk" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "cid" TEXT NOT NULL DEFAULT '',
    "prop" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "time" TEXT NOT NULL DEFAULT '',
    "dur" INTEGER NOT NULL DEFAULT 45,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "agent" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "log" JSONB NOT NULL DEFAULT '[]',
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "who" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'Call',
    "note" TEXT NOT NULL DEFAULT '',
    "due" TEXT NOT NULL DEFAULT 'upcoming',
    "when" TEXT NOT NULL DEFAULT '',
    "done" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "cid" TEXT NOT NULL DEFAULT '',
    "prop" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'sale',
    "stage" TEXT NOT NULL DEFAULT 'negotiation',
    "ask" DOUBLE PRECISION,
    "bid" DOUBLE PRECISION,
    "close" DOUBLE PRECISION,
    "token" JSONB NOT NULL DEFAULT '{}',
    "agr" JSONB NOT NULL DEFAULT '{}',
    "reg" JSONB NOT NULL DEFAULT '{}',
    "bType" TEXT NOT NULL DEFAULT '%',
    "bBuyer" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "bOwner" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "lostReason" TEXT NOT NULL DEFAULT '',
    "expected" TEXT NOT NULL DEFAULT '',
    "stageSince" TEXT NOT NULL DEFAULT '',
    "upd" TEXT NOT NULL DEFAULT '',
    "openedBy" TEXT NOT NULL DEFAULT '',
    "closedBy" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brokerage" (
    "deal" TEXT NOT NULL,
    "due" TEXT NOT NULL DEFAULT '',
    "pay" JSONB NOT NULL DEFAULT '[]',
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brokerage_pkey" PRIMARY KEY ("deal")
);

-- CreateTable
CREATE TABLE "FileRecord" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "cat" TEXT NOT NULL DEFAULT 'Other',
    "size" INTEGER NOT NULL DEFAULT 0,
    "mime" TEXT NOT NULL DEFAULT '',
    "st" TEXT NOT NULL DEFAULT 'Uploaded',
    "valid" TEXT NOT NULL DEFAULT '',
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "path" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KvStore" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KvStore_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Property_purpose_status_idx" ON "Property"("purpose", "status");

-- CreateIndex
CREATE INDEX "Visit_date_idx" ON "Visit"("date");

-- CreateIndex
CREATE INDEX "Visit_cid_idx" ON "Visit"("cid");

-- CreateIndex
CREATE INDEX "FileRecord_scope_idx" ON "FileRecord"("scope");
