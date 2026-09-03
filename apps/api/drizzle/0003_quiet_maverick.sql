ALTER TYPE "public"."event" ADD VALUE IF NOT EXISTS 'ADMIN_MODERATE_POST';--> statement-breakpoint
ALTER TYPE "public"."event" ADD VALUE IF NOT EXISTS 'ADMIN_MODERATE_COMMENT';--> statement-breakpoint
ALTER TYPE "public"."event" ADD VALUE IF NOT EXISTS 'ADMIN_SUSPEND_USER';--> statement-breakpoint
ALTER TYPE "public"."event" ADD VALUE IF NOT EXISTS 'ADMIN_RESTORE_USER';--> statement-breakpoint
ALTER TYPE "public"."event" ADD VALUE IF NOT EXISTS 'ADMIN_RESOLVE_REPORT';--> statement-breakpoint
ALTER TYPE "public"."event" ADD VALUE IF NOT EXISTS 'ADMIN_DISMISS_REPORT';