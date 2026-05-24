CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"user1" text NOT NULL,
	"user2" text,
	"is_multiplayer" boolean NOT NULL,
	"is_timed" boolean NOT NULL,
	"start_time" timestamp with time zone,
	"stop_time" timestamp with time zone,
	CONSTRAINT "games_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" bigint NOT NULL,
	"recepient" text,
	CONSTRAINT "transactions_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"joined" timestamp with time zone DEFAULT now(),
	"balance" bigint NOT NULL,
	CONSTRAINT "users_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_user1_users_id_fk" FOREIGN KEY ("user1") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_user2_users_id_fk" FOREIGN KEY ("user2") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recepient_users_id_fk" FOREIGN KEY ("recepient") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;