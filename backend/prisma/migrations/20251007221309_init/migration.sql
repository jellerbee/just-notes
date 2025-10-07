-- CreateTable
CREATE TABLE "appends" (
    "seq" BIGSERIAL NOT NULL,
    "note_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appends_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "note_type" TEXT NOT NULL DEFAULT 'daily',
    "date" DATE,
    "title" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "last_seq" BIGINT NOT NULL,
    "test_data" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bullets" (
    "id" UUID NOT NULL,
    "note_id" UUID NOT NULL,
    "parent_id" UUID,
    "depth" INTEGER NOT NULL,
    "order_seq" BIGINT NOT NULL,
    "text" TEXT NOT NULL,
    "spans" JSONB NOT NULL DEFAULT '[]',
    "redacted" BOOLEAN NOT NULL DEFAULT false,
    "text_tsv" tsvector,

    CONSTRAINT "bullets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotations" (
    "id" BIGSERIAL NOT NULL,
    "bullet_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" BIGSERIAL NOT NULL,
    "bullet_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_value" TEXT NOT NULL,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" BIGSERIAL NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_seq" INTEGER NOT NULL,
    "bullet_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notes_date_key" ON "notes"("date");

-- CreateIndex
CREATE UNIQUE INDEX "notes_title_key" ON "notes"("title");

-- CreateIndex
CREATE INDEX "idx_bullets_note" ON "bullets"("note_id");

-- CreateIndex
CREATE INDEX "idx_bullets_parent" ON "bullets"("parent_id");

-- CreateIndex
CREATE INDEX "idx_annotations_bullet" ON "annotations"("bullet_id");

-- CreateIndex
CREATE INDEX "idx_links_bullet" ON "links"("bullet_id");

-- CreateIndex
CREATE INDEX "idx_links_target" ON "links"("target_type", "target_value");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_client_id_client_seq_key" ON "idempotency_keys"("client_id", "client_seq");

-- AddForeignKey
ALTER TABLE "bullets" ADD CONSTRAINT "bullets_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bullets" ADD CONSTRAINT "bullets_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "bullets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_bullet_id_fkey" FOREIGN KEY ("bullet_id") REFERENCES "bullets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_bullet_id_fkey" FOREIGN KEY ("bullet_id") REFERENCES "bullets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FTS Trigger Function
CREATE OR REPLACE FUNCTION bullets_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.text_tsv := to_tsvector('english', COALESCE(NEW.text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- FTS Trigger on INSERT and UPDATE
CREATE TRIGGER bullets_fts_update
  BEFORE INSERT OR UPDATE OF text
  ON bullets
  FOR EACH ROW
  EXECUTE FUNCTION bullets_fts_trigger();

-- FTS Index
CREATE INDEX idx_bullets_fts ON bullets USING GIN (text_tsv) WHERE redacted = false;
