import { bigint, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Versioned Drizzle schema for the durable document-preparation process. */
export const docprepEstates = pgTable("docprep_estates", {
  estateId: text("estate_id").primaryKey(),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const docprepCases = pgTable("docprep_cases", {
  id: uuid("id").primaryKey(),
  estateId: text("estate_id").notNull(),
  state: text("state").notNull(),
  revision: integer("revision").notNull(),
  blocker: text("blocker"),
  nextAction: text("next_action"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const docprepEvents = pgTable("docprep_events", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  caseId: uuid("case_id").notNull(),
  eventType: text("event_type").notNull(),
  state: text("state").notNull(),
  stageId: text("stage_id"),
  detail: text("detail").notNull(),
  actorEmail: text("actor_email"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
});

export const docprepSteps = pgTable("docprep_steps", {
  id: text("id").notNull(),
  caseId: uuid("case_id").notNull(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  position: integer("position").notNull(),
  blocker: text("blocker"),
  nextAction: text("next_action"),
  detail: text("detail"),
  evidenceReferences: jsonb("evidence_references").notNull(),
  facts: jsonb("facts").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => [primaryKey({ columns: [table.caseId, table.id] })]);

export const docprepArtifacts = pgTable("docprep_artifacts", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id").notNull(),
  objectKey: text("object_key").notNull(),
  objectVersion: text("object_version"),
  contentType: text("content_type").notNull(),
  bytes: bigint("bytes", { mode: "number" }).notNull(),
  sha256: text("sha256").notNull(),
  readbackStatus: text("readback_status").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  artifactUrl: text("artifact_url"),
});

export const docprepOutbox = pgTable("docprep_outbox", {
  id: uuid("id").primaryKey(),
  caseId: uuid("case_id").notNull(),
  topic: text("topic").notNull(),
  payload: jsonb("payload").notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  attempts: integer("attempts").notNull(),
});
