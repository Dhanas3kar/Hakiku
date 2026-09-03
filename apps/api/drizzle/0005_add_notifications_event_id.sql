ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "event_id" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_notifications_event_id" ON "notifications" USING btree ("event_id");
