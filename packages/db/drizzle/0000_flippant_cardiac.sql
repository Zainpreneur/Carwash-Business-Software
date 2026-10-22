CREATE TABLE `audit_logs` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity` text,
	`entity_id` text,
	`meta` text,
	`ip` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_tenant` ON `audit_logs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `invites` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'staff' NOT NULL,
	`location_id` text,
	`code` text NOT NULL,
	`invited_by_id` text,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`accepted_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`accepted_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_code_unique` ON `invites` (`code`);--> statement-breakpoint
CREATE INDEX `idx_invites_tenant` ON `invites` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `locations` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`address` text,
	`city` text,
	`country` text,
	`phone` text,
	`timezone` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_locations_tenant_code` ON `locations` (`tenant_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_locations_tenant` ON `locations` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `saas_plans` (
	`_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`price_monthly` real DEFAULT 0 NOT NULL,
	`max_locations` integer DEFAULT 1 NOT NULL,
	`max_staff` integer DEFAULT 5 NOT NULL,
	`max_customers` integer DEFAULT 500 NOT NULL,
	`features` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saas_plans_code_unique` ON `saas_plans` (`code`);--> statement-breakpoint
CREATE INDEX `idx_saas_plans_active` ON `saas_plans` (`active`);--> statement-breakpoint
CREATE TABLE `tenant_domains` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`domain` text NOT NULL,
	`primary` integer DEFAULT false NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_domains_domain_unique` ON `tenant_domains` (`domain`);--> statement-breakpoint
CREATE INDEX `idx_tenant_domains_tenant` ON `tenant_domains` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenant_members` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'staff' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`location_id` text,
	`scope_all_locations` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenant_members_tenant_user` ON `tenant_members` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_tenant_members_user` ON `tenant_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `tenant_subscriptions` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`plan_code` text DEFAULT 'starter' NOT NULL,
	`status` text DEFAULT 'trialing' NOT NULL,
	`seats` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`renews_at` integer,
	`canceled_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tenant_subscriptions_tenant` ON `tenant_subscriptions` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'trial' NOT NULL,
	`plan` text DEFAULT 'starter' NOT NULL,
	`logo_url` text,
	`brand_color` text DEFAULT '#0284c7' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`timezone` text DEFAULT 'Asia/Riyadh' NOT NULL,
	`tax_rate` real DEFAULT 0 NOT NULL,
	`phone` text,
	`address` text,
	`settings` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_tenants_status` ON `tenants` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`platform_role` text DEFAULT 'user' NOT NULL,
	`phone` text,
	`active` integer DEFAULT true NOT NULL,
	`avatar_color` text DEFAULT '#2563eb' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_platform_role` ON `users` (`platform_role`);--> statement-breakpoint
CREATE TABLE `auth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_auth_accounts_provider` ON `auth_accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_unique` ON `auth_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_user` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_auth_verifications_identifier` ON `auth_verifications` (`identifier`);--> statement-breakpoint
CREATE TABLE `booking_services` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`service_id` text,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_booking_services_tenant` ON `booking_services` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`location_id` text,
	`booking_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`assigned_staff_id` text,
	`scheduled_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`tax` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`notes` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_staff_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_bookings_tenant` ON `bookings` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_bookings_tenant_location` ON `bookings` (`tenant_id`,`location_id`);--> statement-breakpoint
CREATE INDEX `idx_bookings_tenant_scheduled` ON `bookings` (`tenant_id`,`scheduled_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_bookings_tenant_number` ON `bookings` (`tenant_id`,`booking_number`);--> statement-breakpoint
CREATE TABLE `customers` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text NOT NULL,
	`address` text,
	`notes` text,
	`loyalty_points` integer DEFAULT 0 NOT NULL,
	`total_spent` real DEFAULT 0 NOT NULL,
	`visit_count` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`whatsapp_opt_in` integer DEFAULT true NOT NULL,
	`stripe_customer_id` text,
	`is_fleet_account` integer DEFAULT false NOT NULL,
	`referral_code` text,
	`referred_by_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_customers_tenant` ON `customers` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_customers_tenant_referral` ON `customers` (`tenant_id`,`referral_code`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`location_id` text,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`date` integer NOT NULL,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_tenant` ON `expenses` (`tenant_id`,`date`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`booking_id` text,
	`type` text DEFAULT 'info' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_tenant_user` ON `notifications` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `services` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'basic' NOT NULL,
	`price` real NOT NULL,
	`duration_minutes` integer DEFAULT 30 NOT NULL,
	`vehicle_type_pricing` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_services_tenant` ON `services` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`year` integer,
	`color` text,
	`plate_number` text NOT NULL,
	`type` text DEFAULT 'sedan' NOT NULL,
	`last_wash_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_vehicles_tenant` ON `vehicles` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_vehicles_tenant_plate` ON `vehicles` (`tenant_id`,`plate_number`);--> statement-breakpoint
CREATE TABLE `customer_messages` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`wash_order_id` text,
	`channel` text DEFAULT 'whatsapp' NOT NULL,
	`template` text NOT NULL,
	`automation` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wash_order_id`) REFERENCES `wash_orders`(`_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_customer_messages_tenant` ON `customer_messages` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `package_pricing` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`package_id` text NOT NULL,
	`vehicle_type` text NOT NULL,
	`price` real NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`package_id`) REFERENCES `wash_packages`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_package_pricing_tenant` ON `package_pricing` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `service_bays` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`location_id` text NOT NULL,
	`bay_number` integer NOT NULL,
	`bay_type` text DEFAULT 'tunnel-conveyor' NOT NULL,
	`operational_status` text DEFAULT 'operational' NOT NULL,
	`avg_throughput_per_hour` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_service_bays_tenant` ON `service_bays` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_service_bays_location` ON `service_bays` (`location_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_service_bays_location_number` ON `service_bays` (`location_id`,`bay_number`);--> statement-breakpoint
CREATE TABLE `wash_orders` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`location_id` text,
	`order_number` text NOT NULL,
	`customer_id` text,
	`vehicle_id` text NOT NULL,
	`package_id` text NOT NULL,
	`bay_id` text,
	`assigned_technician_id` text,
	`booking_type` text DEFAULT 'walk-in' NOT NULL,
	`scheduled_for` integer,
	`queue_position` integer,
	`queued_at` integer NOT NULL,
	`bay_assigned_at` integer,
	`wash_started_at` integer,
	`wash_completed_at` integer,
	`checked_out_at` integer,
	`status` text DEFAULT 'queued' NOT NULL,
	`qc_result` text,
	`price` real NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`promo_code` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`package_id`) REFERENCES `wash_packages`(`_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bay_id`) REFERENCES `service_bays`(`_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_technician_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_wash_orders_tenant` ON `wash_orders` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_wash_orders_tenant_location` ON `wash_orders` (`tenant_id`,`location_id`);--> statement-breakpoint
CREATE INDEX `idx_wash_orders_tenant_status` ON `wash_orders` (`tenant_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_wash_orders_tenant_number` ON `wash_orders` (`tenant_id`,`order_number`);--> statement-breakpoint
CREATE TABLE `wash_packages` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`tier` text NOT NULL,
	`name` text NOT NULL,
	`delivery_lane` text DEFAULT 'tunnel' NOT NULL,
	`includes_interior` integer DEFAULT false NOT NULL,
	`avg_cycle_time_minutes` integer DEFAULT 15 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wash_packages_tenant` ON `wash_packages` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `membership_plans` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`tier` text NOT NULL,
	`name` text NOT NULL,
	`covered_package_id` text NOT NULL,
	`monthly_price` real NOT NULL,
	`is_unlimited` integer DEFAULT true NOT NULL,
	`washes_per_month_cap` integer,
	`rollover_allowed` integer DEFAULT false NOT NULL,
	`stripe_price_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`covered_package_id`) REFERENCES `wash_packages`(`_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_membership_plans_tenant` ON `membership_plans` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `membership_subscriptions` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`billing_day_of_month` integer NOT NULL,
	`next_billing_date` integer,
	`paused_until` integer,
	`washes_this_cycle` integer DEFAULT 0 NOT NULL,
	`failed_payment_attempts` integer DEFAULT 0 NOT NULL,
	`first_failed_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`stripe_subscription_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `membership_plans`(`_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_membership_subscriptions_tenant` ON `membership_subscriptions` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `ticket_comments` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`ticket_id` text NOT NULL,
	`author_id` text,
	`author_type` text DEFAULT 'staff' NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_ticket_comments_tenant` ON `ticket_comments` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`location_id` text,
	`customer_id` text NOT NULL,
	`wash_order_id` text,
	`subject` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`description` text,
	`assigned_to_id` text,
	`source` text DEFAULT 'in-app' NOT NULL,
	`first_responded_at` integer,
	`resolved_at` integer,
	`closed_at` integer,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wash_order_id`) REFERENCES `wash_orders`(`_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_tickets_tenant` ON `tickets` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `employees` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`location_id` text,
	`user_id` text,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`position` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`hire_date` integer,
	`hourly_rate` real,
	`annual_salary` real,
	`commission_rate` real,
	`emergency_contact_name` text,
	`emergency_contact_phone` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_employees_tenant` ON `employees` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`reason` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`approved_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_leave_requests_tenant` ON `leave_requests` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`location_id` text,
	`employee_id` text NOT NULL,
	`bay_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`checked_in_at` integer,
	`checked_out_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bay_id`) REFERENCES `service_bays`(`_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_shifts_tenant` ON `shifts` (`tenant_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `location_stock` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`location_id` text NOT NULL,
	`supply_id` text NOT NULL,
	`quantity_on_hand` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supply_id`) REFERENCES `supplies`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_location_stock_location_supply` ON `location_stock` (`location_id`,`supply_id`);--> statement-breakpoint
CREATE INDEX `idx_location_stock_tenant` ON `location_stock` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `package_supply_usage` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`package_id` text NOT NULL,
	`supply_id` text NOT NULL,
	`quantity_per_wash` real NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`package_id`) REFERENCES `wash_packages`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supply_id`) REFERENCES `supplies`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_package_supply_usage_tenant` ON `package_supply_usage` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `purchase_order_lines` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`purchase_order_id` text NOT NULL,
	`supply_id` text NOT NULL,
	`quantity_ordered` real NOT NULL,
	`quantity_received` real DEFAULT 0 NOT NULL,
	`unit_cost` real NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supply_id`) REFERENCES `supplies`(`_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_purchase_order_lines_tenant` ON `purchase_order_lines` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`location_id` text,
	`supplier_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_by_id` text,
	`approved_by_id` text,
	`sent_at` integer,
	`received_at` integer,
	`closed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_purchase_orders_tenant` ON `purchase_orders` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `stock_adjustments` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`location_id` text,
	`supply_id` text NOT NULL,
	`quantity_delta` real NOT NULL,
	`reason_code` text NOT NULL,
	`notes` text,
	`approved_by_id` text NOT NULL,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supply_id`) REFERENCES `supplies`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by_id`) REFERENCES `employees`(`_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_stock_adjustments_tenant` ON `stock_adjustments` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`lead_time_days` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_suppliers_tenant` ON `suppliers` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `supplies` (
	`_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`warehouse` text DEFAULT 'main-chemical-room' NOT NULL,
	`unit` text DEFAULT 'unit' NOT NULL,
	`quantity_on_hand` real DEFAULT 0 NOT NULL,
	`unit_cost` real DEFAULT 0 NOT NULL,
	`supplier_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_supplies_tenant` ON `supplies` (`tenant_id`);