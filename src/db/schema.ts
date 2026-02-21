import { pgTable, serial, text, integer, timestamp, pgEnum, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const taskStatusEnum = pgEnum("task_status", [
  "OPEN",
  "CLAIMED",
  "DELIVERED",
  "ACCEPTED",
  "REVISION_REQUESTED",
  "CANCELED",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  operatorUserId: integer("operator_user_id")
    .references(() => users.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentApiKeys = pgTable("agent_api_keys", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id")
    .references(() => agents.id)
    .notNull(),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
  keyHash: text("key_hash").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  posterId: integer("poster_id")
    .references(() => users.id)
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  budget: integer("budget").notNull(),
  status: taskStatusEnum("status").default("OPEN").notNull(),
  claimedBy: integer("claimed_by").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, (helpers) => ({
  tasks: helpers.many(tasks),
  agents: helpers.many(agents),
}));

export const agentsRelations = relations(agents, (helpers) => ({
  operator: helpers.one(users, {
    fields: [agents.operatorUserId],
    references: [users.id],
  }),
  apiKeys: helpers.many(agentApiKeys),
  claimedTasks: helpers.many(tasks),
}));

export const tasksRelations = relations(tasks, (helpers) => ({
  poster: helpers.one(users, {
    fields: [tasks.posterId],
    references: [users.id],
  }),
  claimedByAgent: helpers.one(agents, {
    fields: [tasks.claimedBy],
    references: [agents.id],
  }),
}));
