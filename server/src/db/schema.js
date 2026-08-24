const {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  jsonb,
} = require('drizzle-orm/pg-core');

const users = pgTable('users', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role').notNull().default('staff'),
  phone: text('phone'),
  active: boolean('active').notNull().default(true),
  avatarColor: text('avatar_color').notNull().default('#2563eb'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const customers = pgTable('customers', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone').notNull(),
  address: text('address'),
  notes: text('notes'),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  totalSpent: doublePrecision('total_spent').notNull().default(0),
  visitCount: integer('visit_count').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const vehicles = pgTable('vehicles', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  customer: uuid('customer_id')
    .notNull()
    .references(() => customers._id, { onDelete: 'cascade' }),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: integer('year'),
  color: text('color'),
  plateNumber: text('plate_number').notNull(),
  type: text('type').notNull().default('sedan'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const services = pgTable('services', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull().default('basic'),
  price: doublePrecision('price').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  vehicleTypePricing: jsonb('vehicle_type_pricing'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const bookings = pgTable('bookings', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  bookingNumber: text('booking_number').notNull().unique(),
  customer: uuid('customer_id')
    .notNull()
    .references(() => customers._id, { onDelete: 'cascade' }),
  vehicle: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles._id, { onDelete: 'cascade' }),
  assignedStaff: uuid('assigned_staff_id').references(() => users._id, { onDelete: 'set null' }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('pending'),
  priority: text('priority').notNull().default('normal'),
  subtotal: doublePrecision('subtotal').notNull().default(0),
  discount: doublePrecision('discount').notNull().default(0),
  tax: doublePrecision('tax').notNull().default(0),
  total: doublePrecision('total').notNull().default(0),
  paymentStatus: text('payment_status').notNull().default('unpaid'),
  paymentMethod: text('payment_method').notNull().default('cash'),
  notes: text('notes'),
  createdBy: uuid('created_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const bookingServices = pgTable('booking_services', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  booking: uuid('booking_id')
    .notNull()
    .references(() => bookings._id, { onDelete: 'cascade' }),
  service: uuid('service_id').references(() => services._id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  price: doublePrecision('price').notNull(),
  position: integer('position').notNull().default(0),
});

const expenses = pgTable('expenses', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  amount: doublePrecision('amount').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by_id').references(() => users._id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const notifications = pgTable('notifications', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  user: uuid('user_id')
    .notNull()
    .references(() => users._id, { onDelete: 'cascade' }),
  booking: uuid('booking_id').references(() => bookings._id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('info'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

module.exports = { users, customers, vehicles, services, bookings, bookingServices, expenses, notifications };
