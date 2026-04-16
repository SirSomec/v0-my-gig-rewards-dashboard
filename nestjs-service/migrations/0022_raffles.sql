CREATE TABLE "raffles" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "title" varchar(256) NOT NULL,
  "description" varchar(2048),
  "status" varchar(32) NOT NULL DEFAULT 'draft',
  "ticket_price" integer NOT NULL,
  "max_tickets_per_user" integer,
  "winners_count" integer NOT NULL DEFAULT 1,
  "cover_image_url" varchar(512),
  "is_visible" integer NOT NULL DEFAULT 1,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "created_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "raffle_prizes" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "raffle_id" integer NOT NULL,
  "title" varchar(256) NOT NULL,
  "description" varchar(2048),
  "image_url" varchar(512),
  "quantity" integer NOT NULL DEFAULT 1,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "raffle_tickets" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "raffle_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "ticket_number" integer NOT NULL,
  "source_ref" varchar(256),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "raffle_winners" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "raffle_id" integer NOT NULL,
  "prize_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "ticket_id" integer NOT NULL,
  "selected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "raffles" ADD CONSTRAINT "raffles_created_by_admin_panel_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_panel_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "raffle_prizes" ADD CONSTRAINT "raffle_prizes_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "raffle_tickets" ADD CONSTRAINT "raffle_tickets_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "raffle_tickets" ADD CONSTRAINT "raffle_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "raffle_winners" ADD CONSTRAINT "raffle_winners_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "raffle_winners" ADD CONSTRAINT "raffle_winners_prize_id_raffle_prizes_id_fk" FOREIGN KEY ("prize_id") REFERENCES "public"."raffle_prizes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "raffle_winners" ADD CONSTRAINT "raffle_winners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "raffle_winners" ADD CONSTRAINT "raffle_winners_ticket_id_raffle_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."raffle_tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_tickets_raffle_ticket_number_uidx" ON "raffle_tickets" USING btree ("raffle_id","ticket_number");
--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_tickets_raffle_source_ref_uidx" ON "raffle_tickets" USING btree ("raffle_id","source_ref");
--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_winners_prize_id_uidx" ON "raffle_winners" USING btree ("prize_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_winners_ticket_id_uidx" ON "raffle_winners" USING btree ("ticket_id");
