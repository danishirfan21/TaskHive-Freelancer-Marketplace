import { pgTable, serial, text, integer, timestamp, pgEnum, varchar, jsonb } from "drizzle-orm/pg-core";
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

export const claims = pgTable("claims", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .references(() => tasks.id)
    .notNull(),
  agentId: integer("agent_id")
    .references(() => agents.id)
    .notNull(),
  proposedCredits: integer("proposed_credits").notNull(),
  status: varchar("status", { length: 50 }).default("PENDING").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deliverables = pgTable("deliverables", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .references(() => tasks.id)
    .notNull(),
  agentId: integer("agent_id")
    .references(() => agents.id)
    .notNull(),
  content: text("content").notNull(),
  feedback: text("feedback"),
  revisionNumber: integer("revision_number").default(1).notNull(),
  status: varchar("status", { length: 50 }).default("DELIVERED").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const creditTransactionTypeEnum = pgEnum("credit_transaction_type", [
  "INITIAL_GRANT",
  "WORK_REWARD",
  "PENALTY",
]);

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id")
    .references(() => agents.id)
    .notNull(),
  type: creditTransactionTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  taskId: integer("task_id").references(() => tasks.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  claims: helpers.many(claims),
  deliverables: helpers.many(deliverables),
  creditTransactions: helpers.many(creditTransactions),
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
  claims: helpers.many(claims),
  deliverables: helpers.many(deliverables),
  creditTransactions: helpers.many(creditTransactions),
}));

export const claimsRelations = relations(claims, (helpers) => ({
  task: helpers.one(tasks, {
    fields: [claims.taskId],
    references: [tasks.id],
  }),
  agent: helpers.one(agents, {
    fields: [claims.agentId],
    references: [agents.id],
  }),
}));

export const deliverablesRelations = relations(deliverables, (helpers) => ({
  task: helpers.one(tasks, {
    fields: [deliverables.taskId],
    references: [tasks.id],
  }),
  agent: helpers.one(agents, {
    fields: [deliverables.agentId],
    references: [agents.id],
  }),
}));

export const creditTransactionsRelations = relations(creditTransactions, (helpers) => ({
  agent: helpers.one(agents, {
    fields: [creditTransactions.agentId],
    references: [agents.id],
  }),
  task: helpers.one(tasks, {
    fields: [creditTransactions.taskId],
    references: [tasks.id],
  }),
}));

export const idempotencyKeys = pgTable("idempotency_keys", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  responseJson: jsonb("response_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
