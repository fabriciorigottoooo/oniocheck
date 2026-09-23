import { randomUUID } from "crypto";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { StepState } from "../lib/types";

export const collaborators = pgTable("collaborators", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  economicGroup: text("economic_group"),
  attendanceUnit: text("attendance_unit"),
  phone: text("phone"),
  checks: jsonb("checks").$type<StepState[]>().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const agendaEventTypes = pgTable("agenda_event_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const agendaEvents = pgTable("agenda_events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  eventTypeId: text("event_type_id").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  notes: text("notes"),
  organizerId: text("organizer_id").notNull(),
  organizerName: text("organizer_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const activities = pgTable("activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  actorColor: text("actor_color").notNull(),
  clientId: text("client_id"),
  clientName: text("client_name").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
