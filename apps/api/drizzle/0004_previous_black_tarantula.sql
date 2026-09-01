ALTER TYPE "public"."notification_type" ADD VALUE 'MENTION';--> statement-breakpoint
ALTER TYPE "public"."report_target_type" ADD VALUE 'HOT_TAKE';--> statement-breakpoint
CREATE TABLE "admin_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hot_takes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"date" text,
	"place" text,
	"time" text,
	"media" text,
	"other_details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "event" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."event";--> statement-breakpoint
CREATE TYPE "public"."event" AS ENUM('OTP_SENT', 'OTP_VERIFIED', 'OTP_FAILED', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESHED', 'ADMIN_LOGIN', 'ADMIN_LOGOUT', 'ADMIN_MODERATE_POST', 'ADMIN_MODERATE_COMMENT', 'ADMIN_MODERATE_HOT_TAKE', 'USER_SUSPENDED', 'USER_BANNED', 'REPORT_RESOLVED', 'REPORT_DISMISSED');--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "event" SET DATA TYPE "public"."event" USING "event"::"public"."event";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "idempotency_key" varchar(100);--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN "post_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "idempotency_key" varchar(100);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "social_links" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "admin_credentials" ADD CONSTRAINT "admin_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hot_takes" ADD CONSTRAINT "hot_takes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_hot_takes_author_created" ON "hot_takes" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_hot_takes_created_at" ON "hot_takes" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_messages_idempotency" ON "messages" USING btree ("sender_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_polls_post_id" ON "polls" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_posts_idempotency" ON "posts" USING btree ("author_id","idempotency_key");