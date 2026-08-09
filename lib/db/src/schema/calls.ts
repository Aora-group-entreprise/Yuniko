import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const callsTable = pgTable("calls", {
  id: text("id").primaryKey(),
  callerId: integer("caller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  targetUserId: integer("target_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  status: text("status").default("ringing").notNull(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const callSignalsTable = pgTable("call_signals", {
  id: serial("id").primaryKey(),
  callId: text("call_id").notNull().references(() => callsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
