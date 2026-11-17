-- Link between a CRM project/property and its WordPress listing.
CREATE TABLE "WebsiteLink" (
    "ref" TEXT NOT NULL,
    "postId" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "media" JSONB NOT NULL DEFAULT '{}',
    "syncedAt" TIMESTAMP(3),
    "syncedBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "WebsiteLink_pkey" PRIMARY KEY ("ref")
);
