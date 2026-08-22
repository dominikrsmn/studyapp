-- CreateTable
CREATE TABLE "SourcePage" (
    "id" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourcePage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourcePage_sourceId_idx" ON "SourcePage"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "SourcePage_sourceId_pageNumber_key" ON "SourcePage"("sourceId", "pageNumber");

-- AddForeignKey
ALTER TABLE "SourcePage" ADD CONSTRAINT "SourcePage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
