import { useState } from "react";
import { 
  Database, Shield, Code, Zap, Eye, ChevronRight, ChevronDown, 
  Table, Lock, FileCode, Layers, ArrowLeft, Copy, Check
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

/* ────────── DATA ────────── */

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default_value: string | null;
}

interface RlsPolicy {
  name: string;
  command: string;
  permissive: string;
  roles: string;
  using: string | null;
  with_check: string | null;
}

interface TableInfo {
  name: string;
  columns: Column[];
  policies: RlsPolicy[];
  foreignKeys: { column: string; refTable: string; refColumn: string }[];
}

interface DbFunction {
  name: string;
  definition: string;
}

interface EdgeFunction {
  name: string;
  code: string;
}

interface ViewInfo {
  name: string;
  definition: string;
}

// ═══ TABLES ═══
const TABLES: TableInfo[] = [
  {
    name: "audit_logs",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "organization_id", type: "uuid", nullable: true, default_value: null },
      { name: "user_id", type: "uuid", nullable: true, default_value: null },
      { name: "action", type: "text", nullable: false, default_value: null },
      { name: "entity", type: "text", nullable: false, default_value: null },
      { name: "entity_id", type: "uuid", nullable: true, default_value: null },
      { name: "metadata_json", type: "jsonb", nullable: true, default_value: "'{}'::jsonb" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "user_role", type: "text", nullable: true, default_value: null },
    ],
    policies: [
      { name: "authenticated users can insert logs", command: "INSERT", permissive: "YES", roles: "authenticated", using: null, with_check: "(user_id = auth.uid())" },
      { name: "icca_admin sees all logs", command: "SELECT", permissive: "YES", roles: "authenticated", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org staff sees org logs", command: "SELECT", permissive: "YES", roles: "authenticated", using: "((organization_id IS NOT NULL) AND (has_org_role(auth.uid(), organization_id, 'org_admin'::app_role) OR has_org_role(auth.uid(), organization_id, 'edital_manager'::app_role)))", with_check: null },
    ],
    foreignKeys: [{ column: "organization_id", refTable: "organizations", refColumn: "id" }],
  },
  {
    name: "bank_statements",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "project_execution_id", type: "uuid", nullable: false, default_value: null },
      { name: "bank_account_id", type: "uuid", nullable: false, default_value: null },
      { name: "file_url", type: "text", nullable: true, default_value: null },
      { name: "statement_period_start", type: "date", nullable: true, default_value: null },
      { name: "statement_period_end", type: "date", nullable: true, default_value: null },
      { name: "extraction_confidence_score", type: "numeric", nullable: true, default_value: null },
      { name: "needs_review", type: "boolean", nullable: false, default_value: "true" },
      { name: "uploaded_by", type: "uuid", nullable: false, default_value: null },
      { name: "confirmed_by", type: "uuid", nullable: true, default_value: null },
      { name: "uploaded_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "confirmed_at", type: "timestamptz", nullable: true, default_value: null },
    ],
    policies: [
      { name: "icca_admin full access statements", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org staff sees org statements", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM project_executions pe WHERE pe.id = bank_statements.project_execution_id AND (has_org_role(auth.uid(), pe.organization_id, 'org_admin'::app_role) OR has_org_role(auth.uid(), pe.organization_id, 'edital_manager'::app_role)))", with_check: null },
      { name: "proponente manages own statements", command: "ALL", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM project_executions pe JOIN proposals p ON p.id = pe.proposal_id WHERE pe.id = bank_statements.project_execution_id AND p.proponente_user_id = auth.uid())", with_check: "EXISTS (SELECT 1 FROM project_executions pe JOIN proposals p ON p.id = pe.proposal_id WHERE pe.id = bank_statements.project_execution_id AND p.proponente_user_id = auth.uid())" },
    ],
    foreignKeys: [
      { column: "bank_account_id", refTable: "project_bank_accounts", refColumn: "id" },
      { column: "project_execution_id", refTable: "project_executions", refColumn: "id" },
    ],
  },
  {
    name: "bank_transactions",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "bank_statement_id", type: "uuid", nullable: false, default_value: null },
      { name: "bank_account_id", type: "uuid", nullable: false, default_value: null },
      { name: "transaction_date", type: "date", nullable: false, default_value: null },
      { name: "posting_date", type: "date", nullable: true, default_value: null },
      { name: "description_raw", type: "text", nullable: false, default_value: null },
      { name: "amount", type: "numeric", nullable: false, default_value: null },
      { name: "direction", type: "text", nullable: false, default_value: "'debit'::text" },
      { name: "balance_after", type: "numeric", nullable: true, default_value: null },
      { name: "document_id_reference", type: "text", nullable: true, default_value: null },
      { name: "parsed_json", type: "jsonb", nullable: true, default_value: "'{}'::jsonb" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access transactions", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org staff sees org transactions", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM bank_statements bs JOIN project_executions pe ON pe.id = bs.project_execution_id WHERE bs.id = bank_transactions.bank_statement_id AND (has_org_role(...)))", with_check: null },
      { name: "proponente manages own transactions", command: "ALL", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM bank_statements bs JOIN project_executions pe ON pe.id = bs.project_execution_id JOIN proposals p ON p.id = pe.proposal_id WHERE bs.id = bank_transactions.bank_statement_id AND p.proponente_user_id = auth.uid())", with_check: "..." },
    ],
    foreignKeys: [
      { column: "bank_account_id", refTable: "project_bank_accounts", refColumn: "id" },
      { column: "bank_statement_id", refTable: "bank_statements", refColumn: "id" },
    ],
  },
  {
    name: "cnpq_areas",
    columns: [
      { name: "code", type: "text", nullable: false, default_value: null },
      { name: "name", type: "text", nullable: false, default_value: null },
      { name: "level", type: "smallint", nullable: false, default_value: null },
      { name: "parent_code", type: "text", nullable: true, default_value: null },
      { name: "full_path", type: "text", nullable: false, default_value: null },
    ],
    policies: [
      { name: "cnpq_areas_admin_manage", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "cnpq_areas_public_read", command: "SELECT", permissive: "YES", roles: "public", using: "true", with_check: null },
    ],
    foreignKeys: [],
  },
  {
    name: "editais",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "organization_id", type: "uuid", nullable: false, default_value: null },
      { name: "title", type: "text", nullable: false, default_value: null },
      { name: "description", type: "text", nullable: true, default_value: null },
      { name: "status", type: "edital_status", nullable: false, default_value: "'draft'::edital_status" },
      { name: "is_public", type: "boolean", nullable: false, default_value: "false" },
      { name: "start_date", type: "timestamptz", nullable: true, default_value: null },
      { name: "end_date", type: "timestamptz", nullable: true, default_value: null },
      { name: "form_id", type: "uuid", nullable: true, default_value: null },
      { name: "blind_review_enabled", type: "boolean", nullable: false, default_value: "true" },
      { name: "blind_code_strategy", type: "text", nullable: false, default_value: "'sequential'::text" },
      { name: "blind_code_prefix", type: "text", nullable: true, default_value: null },
      { name: "min_reviewers_per_proposal", type: "integer", nullable: true, default_value: "3" },
      { name: "review_deadline", type: "date", nullable: true, default_value: null },
      { name: "cancellation_reason", type: "text", nullable: true, default_value: null },
      { name: "published_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "deleted_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "created_by", type: "uuid", nullable: false, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "anyone can view public published editais", command: "SELECT", permissive: "YES", roles: "anon,authenticated", using: "((is_public = true) AND (status = 'published'::edital_status) AND (deleted_at IS NULL))", with_check: null },
      { name: "icca_admin full access editais", command: "ALL", permissive: "YES", roles: "authenticated", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org staff manages editais", command: "ALL", permissive: "YES", roles: "authenticated", using: "(has_org_role(auth.uid(), organization_id, 'org_admin'::app_role) OR has_org_role(auth.uid(), organization_id, 'edital_manager'::app_role))", with_check: null },
      { name: "proponentes see published editais of their org", command: "SELECT", permissive: "YES", roles: "authenticated", using: "((status = 'published'::edital_status) AND is_org_member(auth.uid(), organization_id))", with_check: null },
    ],
    foreignKeys: [
      { column: "form_id", refTable: "forms", refColumn: "id" },
      { column: "organization_id", refTable: "organizations", refColumn: "id" },
    ],
  },
  {
    name: "edital_areas",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "edital_id", type: "uuid", nullable: false, default_value: null },
      { name: "knowledge_area_id", type: "uuid", nullable: false, default_value: null },
    ],
    policies: [
      { name: "icca_admin full access edital_areas", command: "ALL", permissive: "YES", roles: "authenticated", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org members see edital_areas", command: "SELECT", permissive: "YES", roles: "authenticated", using: "EXISTS (SELECT 1 FROM editais e WHERE e.id = edital_areas.edital_id AND is_org_member(auth.uid(), e.organization_id))", with_check: null },
      { name: "org staff manages edital_areas", command: "ALL", permissive: "YES", roles: "authenticated", using: "EXISTS (SELECT 1 FROM editais e WHERE e.id = edital_areas.edital_id AND (has_org_role(...) OR has_org_role(...)))", with_check: null },
    ],
    foreignKeys: [
      { column: "edital_id", refTable: "editais", refColumn: "id" },
      { column: "knowledge_area_id", refTable: "knowledge_areas", refColumn: "id" },
    ],
  },
  {
    name: "edital_form_schemas",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "edital_id", type: "uuid", nullable: false, default_value: null },
      { name: "schema_json", type: "jsonb", nullable: false, default_value: "'[]'::jsonb" },
      { name: "version", type: "integer", nullable: false, default_value: "1" },
      { name: "is_active", type: "boolean", nullable: false, default_value: "true" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access schemas", command: "ALL", permissive: "YES", roles: "authenticated", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org members see active schemas", command: "SELECT", permissive: "YES", roles: "authenticated", using: "((is_active = true) AND EXISTS (SELECT 1 FROM editais e WHERE e.id = edital_form_schemas.edital_id AND is_org_member(auth.uid(), e.organization_id)))", with_check: null },
      { name: "org staff manages schemas", command: "ALL", permissive: "YES", roles: "authenticated", using: "EXISTS (SELECT 1 FROM editais e WHERE e.id = edital_form_schemas.edital_id AND (has_org_role(...)))", with_check: null },
    ],
    foreignKeys: [{ column: "edital_id", refTable: "editais", refColumn: "id" }],
  },
  {
    name: "edital_forms",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "edital_id", type: "uuid", nullable: false, default_value: null },
      { name: "organization_id", type: "uuid", nullable: false, default_value: null },
      { name: "status", type: "text", nullable: false, default_value: "'draft'::text" },
      { name: "knowledge_area_required", type: "boolean", nullable: false, default_value: "false" },
      { name: "knowledge_area_mode", type: "text", nullable: false, default_value: "'single'::text" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access edital_forms", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org members read edital_forms", command: "SELECT", permissive: "YES", roles: "public", using: "is_org_member(auth.uid(), organization_id)", with_check: null },
      { name: "org staff manages edital_forms", command: "ALL", permissive: "YES", roles: "public", using: "(has_org_role(auth.uid(), organization_id, 'org_admin'::app_role) OR has_org_role(auth.uid(), organization_id, 'edital_manager'::app_role))", with_check: null },
    ],
    foreignKeys: [
      { column: "edital_id", refTable: "editais", refColumn: "id" },
      { column: "organization_id", refTable: "organizations", refColumn: "id" },
    ],
  },
  {
    name: "edital_submission_drafts",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "edital_id", type: "uuid", nullable: false, default_value: null },
      { name: "user_id", type: "uuid", nullable: false, default_value: null },
      { name: "answers", type: "jsonb", nullable: false, default_value: "'{}'::jsonb" },
      { name: "cnpq_area_code", type: "text", nullable: true, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "Users manage own drafts", command: "ALL", permissive: "YES", roles: "public", using: "(auth.uid() = user_id)", with_check: "(auth.uid() = user_id)" },
    ],
    foreignKeys: [{ column: "edital_id", refTable: "editais", refColumn: "id" }],
  },
  {
    name: "edital_submissions",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "edital_id", type: "uuid", nullable: false, default_value: null },
      { name: "user_id", type: "uuid", nullable: false, default_value: null },
      { name: "form_version_id", type: "uuid", nullable: true, default_value: null },
      { name: "answers", type: "jsonb", nullable: false, default_value: "'{}'::jsonb" },
      { name: "cnpq_area_code", type: "text", nullable: true, default_value: null },
      { name: "status", type: "text", nullable: false, default_value: "'draft'::text" },
      { name: "protocol", type: "text", nullable: true, default_value: null },
      { name: "submitted_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "Org admins read edital submissions", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM editais e JOIN organization_members om ON om.organization_id = e.organization_id WHERE e.id = edital_submissions.edital_id AND om.user_id = auth.uid() AND om.role IN ('org_admin','edital_manager','icca_admin'))", with_check: null },
      { name: "Users insert own submissions", command: "INSERT", permissive: "YES", roles: "public", using: null, with_check: "(auth.uid() = user_id)" },
      { name: "Users read own submissions", command: "SELECT", permissive: "YES", roles: "public", using: "(auth.uid() = user_id)", with_check: null },
      { name: "Users update own draft submissions", command: "UPDATE", permissive: "YES", roles: "public", using: "(auth.uid() = user_id)", with_check: null },
      { name: "icca_admin full access edital_submissions", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
    ],
    foreignKeys: [
      { column: "edital_id", refTable: "editais", refColumn: "id" },
      { column: "form_version_id", refTable: "form_versions", refColumn: "id" },
    ],
  },
  {
    name: "edital_submission_files",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "submission_id", type: "uuid", nullable: false, default_value: null },
      { name: "file_url", type: "text", nullable: false, default_value: null },
      { name: "file_type", type: "text", nullable: false, default_value: "'proposal_pdf'::text" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "Org admins read submission files", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (...)", with_check: null },
      { name: "Service insert submission files", command: "INSERT", permissive: "YES", roles: "public", using: null, with_check: "EXISTS (SELECT 1 FROM edital_submissions es WHERE es.id = submission_id AND es.user_id = auth.uid())" },
      { name: "Users read own submission files", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM edital_submissions es WHERE es.id = submission_id AND es.user_id = auth.uid())", with_check: null },
      { name: "icca_admin full access submission files", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
    ],
    foreignKeys: [{ column: "submission_id", refTable: "edital_submissions", refColumn: "id" }],
  },
  {
    name: "expense_payments",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "expense_id", type: "uuid", nullable: false, default_value: null },
      { name: "bank_transaction_id", type: "uuid", nullable: false, default_value: null },
      { name: "paid_amount", type: "numeric", nullable: false, default_value: null },
      { name: "paid_date", type: "date", nullable: false, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access payments", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org staff sees org payments", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (...via project_expenses → project_executions...)", with_check: null },
      { name: "proponente manages own payments", command: "ALL", permissive: "YES", roles: "public", using: "EXISTS (...via project_expenses → project_executions → proposals WHERE proponente_user_id = auth.uid())", with_check: "..." },
    ],
    foreignKeys: [
      { column: "expense_id", refTable: "project_expenses", refColumn: "id" },
      { column: "bank_transaction_id", refTable: "bank_transactions", refColumn: "id" },
    ],
  },
  {
    name: "form_fields",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "form_id", type: "uuid", nullable: false, default_value: null },
      { name: "field_type", type: "field_type", nullable: false, default_value: "'text'::field_type" },
      { name: "label", type: "text", nullable: false, default_value: null },
      { name: "is_required", type: "boolean", nullable: false, default_value: "false" },
      { name: "sort_order", type: "integer", nullable: false, default_value: "0" },
      { name: "min_chars", type: "integer", nullable: true, default_value: null },
      { name: "max_chars", type: "integer", nullable: true, default_value: null },
      { name: "help_text", type: "text", nullable: true, default_value: null },
      { name: "section_title", type: "text", nullable: true, default_value: null },
      { name: "section_description", type: "text", nullable: true, default_value: null },
      { name: "options", type: "jsonb", nullable: true, default_value: null },
      { name: "validation_rules", type: "jsonb", nullable: true, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access form_fields", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org members read published form_fields", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM forms f WHERE f.id = form_fields.form_id AND f.status = 'published' AND is_org_member(auth.uid(), f.organization_id))", with_check: null },
      { name: "org staff manages form_fields", command: "ALL", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM forms f WHERE f.id = form_fields.form_id AND (has_org_role(...)))", with_check: null },
    ],
    foreignKeys: [{ column: "form_id", refTable: "forms", refColumn: "id" }],
  },
  {
    name: "form_knowledge_areas",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "form_id", type: "uuid", nullable: false, default_value: null },
      { name: "name", type: "text", nullable: false, default_value: null },
      { name: "code", type: "text", nullable: true, default_value: null },
      { name: "description", type: "text", nullable: true, default_value: null },
      { name: "sort_order", type: "integer", nullable: false, default_value: "0" },
      { name: "is_active", type: "boolean", nullable: false, default_value: "true" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org members read", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM edital_forms ef WHERE ef.id = form_id AND is_org_member(auth.uid(), ef.organization_id))", with_check: null },
      { name: "org staff manages", command: "ALL", permissive: "YES", roles: "public", using: "EXISTS (...)", with_check: null },
    ],
    foreignKeys: [{ column: "form_id", refTable: "edital_forms", refColumn: "id" }],
  },
  {
    name: "form_question_options",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "question_id", type: "uuid", nullable: false, default_value: null },
      { name: "label", type: "text", nullable: false, default_value: null },
      { name: "value", type: "text", nullable: false, default_value: null },
      { name: "sort_order", type: "integer", nullable: false, default_value: "0" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "Org admins can delete", command: "DELETE", permissive: "YES", roles: "public", using: "EXISTS (...via form_questions → edital_forms → org_members...)", with_check: null },
      { name: "Org admins can insert", command: "INSERT", permissive: "YES", roles: "public", using: null, with_check: "EXISTS (...)" },
      { name: "Org admins can update", command: "UPDATE", permissive: "YES", roles: "public", using: "EXISTS (...)", with_check: null },
      { name: "Org members can read", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (...)", with_check: null },
    ],
    foreignKeys: [{ column: "question_id", refTable: "form_questions", refColumn: "id" }],
  },
  {
    name: "form_questions",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "form_id", type: "uuid", nullable: false, default_value: null },
      { name: "section_id", type: "uuid", nullable: true, default_value: null },
      { name: "label", type: "text", nullable: false, default_value: null },
      { name: "type", type: "text", nullable: false, default_value: "'short_text'::text" },
      { name: "section", type: "text", nullable: false, default_value: "'default'::text" },
      { name: "is_required", type: "boolean", nullable: false, default_value: "false" },
      { name: "sort_order", type: "integer", nullable: false, default_value: "0" },
      { name: "help_text", type: "text", nullable: true, default_value: null },
      { name: "options", type: "jsonb", nullable: true, default_value: null },
      { name: "options_source", type: "text", nullable: true, default_value: null },
      { name: "validation_rules", type: "jsonb", nullable: true, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org members read", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM edital_forms ef WHERE ef.id = form_id AND is_org_member(auth.uid(), ef.organization_id))", with_check: null },
      { name: "org staff manages", command: "ALL", permissive: "YES", roles: "public", using: "EXISTS (...)", with_check: null },
    ],
    foreignKeys: [
      { column: "form_id", refTable: "edital_forms", refColumn: "id" },
      { column: "section_id", refTable: "form_sections", refColumn: "id" },
    ],
  },
  {
    name: "form_response_drafts",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "form_id", type: "uuid", nullable: false, default_value: null },
      { name: "edital_id", type: "uuid", nullable: false, default_value: null },
      { name: "user_id", type: "uuid", nullable: false, default_value: null },
      { name: "data", type: "jsonb", nullable: false, default_value: "'{}'::jsonb" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "Users can delete own drafts", command: "DELETE", permissive: "YES", roles: "public", using: "(auth.uid() = user_id)", with_check: null },
      { name: "Users can insert own drafts", command: "INSERT", permissive: "YES", roles: "public", using: null, with_check: "(auth.uid() = user_id)" },
      { name: "Users can read own drafts", command: "SELECT", permissive: "YES", roles: "public", using: "(auth.uid() = user_id)", with_check: null },
      { name: "Users can update own drafts", command: "UPDATE", permissive: "YES", roles: "public", using: "(auth.uid() = user_id)", with_check: null },
    ],
    foreignKeys: [
      { column: "edital_id", refTable: "editais", refColumn: "id" },
      { column: "form_id", refTable: "edital_forms", refColumn: "id" },
    ],
  },
  {
    name: "form_sections",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "form_id", type: "uuid", nullable: false, default_value: null },
      { name: "title", type: "text", nullable: false, default_value: null },
      { name: "description", type: "text", nullable: true, default_value: null },
      { name: "sort_order", type: "integer", nullable: false, default_value: "0" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "Org admins can delete/insert/update", command: "ALL (per-op)", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM edital_forms ef JOIN organization_members om ON ... WHERE role IN ('org_admin','edital_manager','icca_admin'))", with_check: null },
      { name: "Org members can read", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (...)", with_check: null },
    ],
    foreignKeys: [{ column: "form_id", refTable: "edital_forms", refColumn: "id" }],
  },
  {
    name: "form_versions",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "form_id", type: "uuid", nullable: false, default_value: null },
      { name: "version", type: "integer", nullable: false, default_value: "1" },
      { name: "snapshot", type: "jsonb", nullable: false, default_value: null },
      { name: "status", type: "text", nullable: false, default_value: "'published'::text" },
      { name: "created_by", type: "uuid", nullable: true, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "Org admins can insert", command: "INSERT", permissive: "YES", roles: "public", using: null, with_check: "EXISTS (...)" },
      { name: "Org members can read", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (...)", with_check: null },
    ],
    foreignKeys: [{ column: "form_id", refTable: "edital_forms", refColumn: "id" }],
  },
  {
    name: "forms",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "organization_id", type: "uuid", nullable: false, default_value: null },
      { name: "name", type: "text", nullable: false, default_value: null },
      { name: "code", type: "text", nullable: false, default_value: null },
      { name: "description", type: "text", nullable: true, default_value: null },
      { name: "status", type: "form_status", nullable: false, default_value: "'draft'::form_status" },
      { name: "version", type: "integer", nullable: false, default_value: "1" },
      { name: "created_by", type: "uuid", nullable: false, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access forms", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org members read published forms", command: "SELECT", permissive: "YES", roles: "public", using: "((status = 'published') AND is_org_member(auth.uid(), organization_id))", with_check: null },
      { name: "org staff manages forms", command: "ALL", permissive: "YES", roles: "public", using: "(has_org_role(..., 'org_admin') OR has_org_role(..., 'edital_manager'))", with_check: null },
    ],
    foreignKeys: [{ column: "organization_id", refTable: "organizations", refColumn: "id" }],
  },
  {
    name: "identity_reveals",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "edital_id", type: "uuid", nullable: false, default_value: null },
      { name: "proposal_id", type: "uuid", nullable: false, default_value: null },
      { name: "revealed_by", type: "uuid", nullable: false, default_value: null },
      { name: "reason", type: "text", nullable: false, default_value: null },
      { name: "revealed_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin_manages_reveals", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org_staff_manages_reveals", command: "ALL", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM editais e WHERE e.id = edital_id AND (has_org_role(...)))", with_check: null },
    ],
    foreignKeys: [
      { column: "edital_id", refTable: "editais", refColumn: "id" },
      { column: "proposal_id", refTable: "proposals", refColumn: "id" },
    ],
  },
  {
    name: "institutions",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "name", type: "text", nullable: false, default_value: null },
      { name: "sigla", type: "text", nullable: true, default_value: null },
      { name: "category", type: "text", nullable: true, default_value: null },
      { name: "organization_type", type: "text", nullable: true, default_value: null },
      { name: "municipio", type: "text", nullable: true, default_value: null },
      { name: "uf", type: "text", nullable: true, default_value: null },
      { name: "is_active", type: "boolean", nullable: false, default_value: "true" },
      { name: "source", type: "text", nullable: false, default_value: "'eMEC'::text" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "Admins manage institutions", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "Anyone can read institutions", command: "SELECT", permissive: "YES", roles: "public", using: "true", with_check: null },
    ],
    foreignKeys: [],
  },
  {
    name: "knowledge_areas",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "organization_id", type: "uuid", nullable: false, default_value: null },
      { name: "edital_id", type: "uuid", nullable: true, default_value: null },
      { name: "name", type: "text", nullable: false, default_value: null },
      { name: "code", type: "text", nullable: true, default_value: null },
      { name: "level", type: "smallint", nullable: false, default_value: "1" },
      { name: "parent_id", type: "uuid", nullable: true, default_value: null },
      { name: "sort_order", type: "integer", nullable: false, default_value: "0" },
      { name: "is_active", type: "boolean", nullable: false, default_value: "true" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access areas", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org members see areas", command: "SELECT", permissive: "YES", roles: "public", using: "is_org_member(auth.uid(), organization_id)", with_check: null },
      { name: "org staff manages areas", command: "ALL", permissive: "YES", roles: "public", using: "(has_org_role(..., 'org_admin') OR has_org_role(..., 'edital_manager'))", with_check: null },
    ],
    foreignKeys: [
      { column: "organization_id", refTable: "organizations", refColumn: "id" },
      { column: "edital_id", refTable: "editais", refColumn: "id" },
      { column: "parent_id", refTable: "knowledge_areas", refColumn: "id" },
    ],
  },
  {
    name: "organization_members",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "user_id", type: "uuid", nullable: false, default_value: null },
      { name: "organization_id", type: "uuid", nullable: false, default_value: null },
      { name: "role", type: "app_role", nullable: false, default_value: "'proponente'::app_role" },
      { name: "status", type: "text", nullable: false, default_value: "'ativo'::text" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access members", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "members see own org members", command: "SELECT", permissive: "YES", roles: "public", using: "is_org_member(auth.uid(), organization_id)", with_check: null },
      { name: "org_admin manages members", command: "ALL", permissive: "YES", roles: "public", using: "has_org_role(auth.uid(), organization_id, 'org_admin'::app_role)", with_check: null },
    ],
    foreignKeys: [{ column: "organization_id", refTable: "organizations", refColumn: "id" }],
  },
  {
    name: "organizations",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "name", type: "text", nullable: false, default_value: null },
      { name: "slug", type: "text", nullable: false, default_value: null },
      { name: "is_active", type: "boolean", nullable: false, default_value: "true" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "anyone can view active orgs", command: "SELECT", permissive: "YES", roles: "public", using: "(is_active = true)", with_check: null },
      { name: "icca_admin full access", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org members can view their org", command: "SELECT", permissive: "YES", roles: "public", using: "is_org_member(auth.uid(), id)", with_check: null },
    ],
    foreignKeys: [],
  },
  {
    name: "profiles",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "user_id", type: "uuid", nullable: false, default_value: null },
      { name: "email", type: "text", nullable: true, default_value: null },
      { name: "full_name", type: "text", nullable: true, default_value: null },
      { name: "cpf", type: "text", nullable: true, default_value: null },
      { name: "cpf_hash", type: "text", nullable: true, default_value: null },
      { name: "phone", type: "text", nullable: true, default_value: null },
      { name: "whatsapp", type: "text", nullable: true, default_value: null },
      { name: "photo_url", type: "text", nullable: true, default_value: null },
      { name: "mini_bio", type: "text", nullable: true, default_value: null },
      { name: "institution_id", type: "uuid", nullable: true, default_value: null },
      { name: "institution_affiliation", type: "text", nullable: true, default_value: null },
      { name: "institution_custom_name", type: "text", nullable: true, default_value: null },
      { name: "institution_type", type: "text", nullable: true, default_value: null },
      { name: "professional_position", type: "text", nullable: true, default_value: null },
      { name: "lattes_url", type: "text", nullable: true, default_value: null },
      { name: "linkedin_url", type: "text", nullable: true, default_value: null },
      { name: "instagram_url", type: "text", nullable: true, default_value: null },
      { name: "research_area_cnpq", type: "text", nullable: true, default_value: null },
      { name: "keywords", type: "text[]", nullable: true, default_value: null },
      { name: "address_street", type: "text", nullable: true, default_value: null },
      { name: "address_number", type: "text", nullable: true, default_value: null },
      { name: "address_complement", type: "text", nullable: true, default_value: null },
      { name: "address_neighborhood", type: "text", nullable: true, default_value: null },
      { name: "address_city", type: "text", nullable: true, default_value: null },
      { name: "address_state", type: "text", nullable: true, default_value: null },
      { name: "address_country", type: "text", nullable: true, default_value: "'Brasil'::text" },
      { name: "address_zipcode", type: "text", nullable: true, default_value: null },
      { name: "profile_completed", type: "boolean", nullable: true, default_value: "false" },
      { name: "profile_completed_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "receive_news", type: "boolean", nullable: true, default_value: "true" },
      { name: "receive_editais_notifications", type: "boolean", nullable: true, default_value: "true" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin sees all profiles", command: "SELECT", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org admins see org member profiles", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM organization_members om WHERE om.user_id = profiles.user_id AND (has_org_role(auth.uid(), om.organization_id, 'org_admin') OR has_org_role(..., 'edital_manager')))", with_check: null },
      { name: "users see own profile", command: "SELECT", permissive: "YES", roles: "public", using: "(user_id = auth.uid())", with_check: null },
      { name: "users update own profile", command: "UPDATE", permissive: "YES", roles: "public", using: "(user_id = auth.uid())", with_check: null },
    ],
    foreignKeys: [{ column: "institution_id", refTable: "institutions", refColumn: "id" }],
  },
  {
    name: "project_bank_accounts",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "project_execution_id", type: "uuid", nullable: false, default_value: null },
      { name: "bank_name", type: "text", nullable: false, default_value: null },
      { name: "bank_code", type: "text", nullable: true, default_value: null },
      { name: "branch_number", type: "text", nullable: false, default_value: null },
      { name: "account_number", type: "text", nullable: false, default_value: null },
      { name: "account_type", type: "text", nullable: false, default_value: "'corrente'::text" },
      { name: "account_holder_name", type: "text", nullable: false, default_value: null },
      { name: "account_holder_document", type: "text", nullable: false, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org staff sees org bank accounts", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (...via project_executions...)", with_check: null },
      { name: "proponente manages own", command: "ALL", permissive: "YES", roles: "public", using: "EXISTS (...via project_executions → proposals WHERE proponente_user_id = auth.uid())", with_check: "..." },
    ],
    foreignKeys: [{ column: "project_execution_id", refTable: "project_executions", refColumn: "id" }],
  },
  {
    name: "project_executions",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "edital_id", type: "uuid", nullable: false, default_value: null },
      { name: "organization_id", type: "uuid", nullable: false, default_value: null },
      { name: "proposal_id", type: "uuid", nullable: false, default_value: null },
      { name: "created_by", type: "uuid", nullable: false, default_value: null },
      { name: "title", type: "text", nullable: true, default_value: null },
      { name: "status", type: "text", nullable: false, default_value: "'active'::text" },
      { name: "total_budget", type: "numeric", nullable: true, default_value: "0" },
      { name: "start_date", type: "date", nullable: true, default_value: null },
      { name: "end_date", type: "date", nullable: true, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org staff sees org executions", command: "SELECT", permissive: "YES", roles: "public", using: "(has_org_role(auth.uid(), organization_id, 'org_admin') OR has_org_role(...))", with_check: null },
      { name: "proponente manages own", command: "ALL", permissive: "YES", roles: "public", using: "EXISTS (SELECT 1 FROM proposals p WHERE p.id = proposal_id AND p.proponente_user_id = auth.uid())", with_check: "..." },
    ],
    foreignKeys: [
      { column: "edital_id", refTable: "editais", refColumn: "id" },
      { column: "organization_id", refTable: "organizations", refColumn: "id" },
      { column: "proposal_id", refTable: "proposals", refColumn: "id" },
    ],
  },
  {
    name: "project_expenses",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "project_execution_id", type: "uuid", nullable: false, default_value: null },
      { name: "description", type: "text", nullable: false, default_value: null },
      { name: "total_value", type: "numeric", nullable: false, default_value: "0" },
      { name: "category", type: "text", nullable: true, default_value: null },
      { name: "supplier_name", type: "text", nullable: true, default_value: null },
      { name: "supplier_document", type: "text", nullable: true, default_value: null },
      { name: "invoice_number", type: "text", nullable: true, default_value: null },
      { name: "issue_date", type: "date", nullable: true, default_value: null },
      { name: "status", type: "text", nullable: false, default_value: "'pending'::text" },
      { name: "notes", type: "text", nullable: true, default_value: null },
      { name: "created_by", type: "uuid", nullable: false, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "icca_admin full access", command: "ALL", permissive: "YES", roles: "public", using: "has_role(auth.uid(), 'icca_admin'::app_role)", with_check: null },
      { name: "org staff sees org expenses", command: "SELECT", permissive: "YES", roles: "public", using: "EXISTS (...via project_executions...)", with_check: null },
      { name: "proponente manages own", command: "ALL", permissive: "YES", roles: "public", using: "EXISTS (...via project_executions → proposals...)", with_check: "..." },
    ],
    foreignKeys: [{ column: "project_execution_id", refTable: "project_executions", refColumn: "id" }],
  },
  {
    name: "project_refunds",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "project_execution_id", type: "uuid", nullable: false, default_value: null },
      { name: "description", type: "text", nullable: false, default_value: null },
      { name: "amount", type: "numeric", nullable: false, default_value: "0" },
      { name: "reason", type: "text", nullable: true, default_value: null },
      { name: "refund_date", type: "date", nullable: true, default_value: null },
      { name: "status", type: "text", nullable: false, default_value: "'pending'::text" },
      { name: "created_by", type: "uuid", nullable: false, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [
      { name: "Similar pattern: icca_admin + org_staff + proponente", command: "ALL/SELECT", permissive: "YES", roles: "public", using: "...", with_check: null },
    ],
    foreignKeys: [{ column: "project_execution_id", refTable: "project_executions", refColumn: "id" }],
  },
  {
    name: "proposal_answers",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "proposal_id", type: "uuid", nullable: false, default_value: null },
      { name: "answers_json", type: "jsonb", nullable: false, default_value: "'{}'::jsonb" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [],
    foreignKeys: [{ column: "proposal_id", refTable: "proposals", refColumn: "id" }],
  },
  {
    name: "proposal_decisions",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "proposal_id", type: "uuid", nullable: false, default_value: null },
      { name: "decision", type: "text", nullable: false, default_value: null },
      { name: "justification", type: "text", nullable: true, default_value: null },
      { name: "decided_by", type: "uuid", nullable: false, default_value: null },
      { name: "decided_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [],
    foreignKeys: [{ column: "proposal_id", refTable: "proposals", refColumn: "id" }],
  },
  {
    name: "proposal_files",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "proposal_id", type: "uuid", nullable: false, default_value: null },
      { name: "file_path", type: "text", nullable: false, default_value: null },
      { name: "file_type", type: "text", nullable: true, default_value: null },
      { name: "uploaded_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [],
    foreignKeys: [{ column: "proposal_id", refTable: "proposals", refColumn: "id" }],
  },
  {
    name: "proposal_reviewer_conflicts",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "proposal_id", type: "uuid", nullable: false, default_value: null },
      { name: "reviewer_user_id", type: "uuid", nullable: false, default_value: null },
      { name: "edital_id", type: "uuid", nullable: false, default_value: null },
      { name: "org_id", type: "uuid", nullable: false, default_value: null },
      { name: "reason", type: "text", nullable: true, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [],
    foreignKeys: [
      { column: "proposal_id", refTable: "proposals", refColumn: "id" },
      { column: "edital_id", refTable: "editais", refColumn: "id" },
      { column: "org_id", refTable: "organizations", refColumn: "id" },
    ],
  },
  {
    name: "proposals",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "edital_id", type: "uuid", nullable: false, default_value: null },
      { name: "organization_id", type: "uuid", nullable: false, default_value: null },
      { name: "proponente_user_id", type: "uuid", nullable: false, default_value: null },
      { name: "knowledge_area_id", type: "uuid", nullable: true, default_value: null },
      { name: "status", type: "proposal_status", nullable: false, default_value: "'draft'::proposal_status" },
      { name: "blind_code", type: "text", nullable: true, default_value: null },
      { name: "blind_code_generated_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "submitted_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [],
    foreignKeys: [
      { column: "edital_id", refTable: "editais", refColumn: "id" },
      { column: "organization_id", refTable: "organizations", refColumn: "id" },
      { column: "knowledge_area_id", refTable: "knowledge_areas", refColumn: "id" },
    ],
  },
  {
    name: "reconciliations",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "project_execution_id", type: "uuid", nullable: false, default_value: null },
      { name: "bank_transaction_id", type: "uuid", nullable: false, default_value: null },
      { name: "expense_id", type: "uuid", nullable: true, default_value: null },
      { name: "refund_id", type: "uuid", nullable: true, default_value: null },
      { name: "status", type: "text", nullable: false, default_value: "'pending'::text" },
      { name: "match_rule", type: "text", nullable: true, default_value: null },
      { name: "notes", type: "text", nullable: true, default_value: null },
      { name: "decided_by", type: "uuid", nullable: true, default_value: null },
      { name: "decided_at", type: "timestamptz", nullable: true, default_value: null },
    ],
    policies: [],
    foreignKeys: [
      { column: "project_execution_id", refTable: "project_executions", refColumn: "id" },
      { column: "bank_transaction_id", refTable: "bank_transactions", refColumn: "id" },
      { column: "expense_id", refTable: "project_expenses", refColumn: "id" },
      { column: "refund_id", refTable: "project_refunds", refColumn: "id" },
    ],
  },
  {
    name: "review_assignments",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "proposal_id", type: "uuid", nullable: false, default_value: null },
      { name: "reviewer_user_id", type: "uuid", nullable: false, default_value: null },
      { name: "assigned_by", type: "uuid", nullable: false, default_value: null },
      { name: "status", type: "text", nullable: false, default_value: "'pending'::text" },
      { name: "conflict_declared", type: "boolean", nullable: false, default_value: "false" },
      { name: "conflict_reason", type: "text", nullable: true, default_value: null },
      { name: "assigned_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "submitted_at", type: "timestamptz", nullable: true, default_value: null },
    ],
    policies: [],
    foreignKeys: [{ column: "proposal_id", refTable: "proposals", refColumn: "id" }],
  },
  {
    name: "review_scores",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "review_id", type: "uuid", nullable: false, default_value: null },
      { name: "criteria_id", type: "uuid", nullable: false, default_value: null },
      { name: "score", type: "numeric", nullable: false, default_value: null },
      { name: "comment", type: "text", nullable: true, default_value: null },
    ],
    policies: [],
    foreignKeys: [
      { column: "review_id", refTable: "reviews", refColumn: "id" },
      { column: "criteria_id", refTable: "scoring_criteria", refColumn: "id" },
    ],
  },
  {
    name: "reviewer_conflicts",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "reviewer_id", type: "uuid", nullable: false, default_value: null },
      { name: "org_id", type: "uuid", nullable: false, default_value: null },
      { name: "conflict_type", type: "text", nullable: false, default_value: "'institutional'::text" },
      { name: "description", type: "text", nullable: true, default_value: null },
      { name: "user_id", type: "uuid", nullable: true, default_value: null },
      { name: "declared_by", type: "uuid", nullable: true, default_value: null },
      { name: "declared_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [],
    foreignKeys: [
      { column: "reviewer_id", refTable: "reviewers", refColumn: "id" },
      { column: "org_id", refTable: "organizations", refColumn: "id" },
    ],
  },
  {
    name: "reviewer_invites",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "org_id", type: "uuid", nullable: false, default_value: null },
      { name: "email", type: "text", nullable: false, default_value: null },
      { name: "full_name", type: "text", nullable: true, default_value: null },
      { name: "institution", type: "text", nullable: true, default_value: null },
      { name: "institution_id", type: "uuid", nullable: true, default_value: null },
      { name: "institution_custom_name", type: "text", nullable: true, default_value: null },
      { name: "institution_type", type: "text", nullable: true, default_value: null },
      { name: "areas", type: "jsonb", nullable: true, default_value: null },
      { name: "keywords", type: "text[]", nullable: true, default_value: null },
      { name: "lattes_url", type: "text", nullable: true, default_value: null },
      { name: "orcid", type: "text", nullable: true, default_value: null },
      { name: "reviewer_id", type: "uuid", nullable: true, default_value: null },
      { name: "token_hash", type: "text", nullable: true, default_value: null },
      { name: "invite_code", type: "text", nullable: true, default_value: null },
      { name: "expires_at", type: "timestamptz", nullable: false, default_value: null },
      { name: "used_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [],
    foreignKeys: [
      { column: "org_id", refTable: "organizations", refColumn: "id" },
      { column: "institution_id", refTable: "institutions", refColumn: "id" },
      { column: "reviewer_id", refTable: "reviewers", refColumn: "id" },
    ],
  },
  {
    name: "reviewer_profiles",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "user_id", type: "uuid", nullable: false, default_value: null },
      { name: "org_id", type: "uuid", nullable: false, default_value: null },
      { name: "areas", type: "jsonb", nullable: false, default_value: "'[]'::jsonb" },
      { name: "keywords", type: "text[]", nullable: true, default_value: null },
      { name: "orcid", type: "text", nullable: true, default_value: null },
      { name: "bio", type: "text", nullable: true, default_value: null },
      { name: "terms_version", type: "text", nullable: true, default_value: null },
      { name: "accepted_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "first_terms_accepted_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [],
    foreignKeys: [{ column: "org_id", refTable: "organizations", refColumn: "id" }],
  },
  {
    name: "reviewers",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "org_id", type: "uuid", nullable: false, default_value: null },
      { name: "user_id", type: "uuid", nullable: true, default_value: null },
      { name: "email", type: "text", nullable: false, default_value: null },
      { name: "full_name", type: "text", nullable: false, default_value: null },
      { name: "institution", type: "text", nullable: false, default_value: null },
      { name: "institution_id", type: "uuid", nullable: true, default_value: null },
      { name: "institution_custom_name", type: "text", nullable: true, default_value: null },
      { name: "institution_type", type: "text", nullable: true, default_value: null },
      { name: "areas", type: "jsonb", nullable: false, default_value: "'[]'::jsonb" },
      { name: "keywords", type: "text[]", nullable: true, default_value: null },
      { name: "lattes_url", type: "text", nullable: true, default_value: null },
      { name: "orcid", type: "text", nullable: true, default_value: null },
      { name: "bio", type: "text", nullable: true, default_value: null },
      { name: "status", type: "text", nullable: false, default_value: "'pending'::text" },
      { name: "cpf_hash", type: "text", nullable: true, default_value: null },
      { name: "cpf_last4", type: "text", nullable: true, default_value: null },
      { name: "terms_version", type: "text", nullable: true, default_value: null },
      { name: "first_terms_accepted_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "accepted_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "invited_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [],
    foreignKeys: [
      { column: "org_id", refTable: "organizations", refColumn: "id" },
      { column: "institution_id", refTable: "institutions", refColumn: "id" },
    ],
  },
  {
    name: "reviews",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "assignment_id", type: "uuid", nullable: false, default_value: null },
      { name: "proposal_id", type: "uuid", nullable: false, default_value: null },
      { name: "reviewer_user_id", type: "uuid", nullable: false, default_value: null },
      { name: "overall_score", type: "numeric", nullable: true, default_value: null },
      { name: "recommendation", type: "text", nullable: true, default_value: null },
      { name: "comments_to_committee", type: "text", nullable: true, default_value: null },
      { name: "submitted_at", type: "timestamptz", nullable: true, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [],
    foreignKeys: [
      { column: "assignment_id", refTable: "review_assignments", refColumn: "id" },
      { column: "proposal_id", refTable: "proposals", refColumn: "id" },
    ],
  },
  {
    name: "scoring_criteria",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "edital_id", type: "uuid", nullable: false, default_value: null },
      { name: "name", type: "text", nullable: false, default_value: null },
      { name: "description", type: "text", nullable: true, default_value: null },
      { name: "max_score", type: "numeric", nullable: false, default_value: "10" },
      { name: "weight", type: "numeric", nullable: false, default_value: "1" },
      { name: "sort_order", type: "integer", nullable: false, default_value: "0" },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [],
    foreignKeys: [{ column: "edital_id", refTable: "editais", refColumn: "id" }],
  },
  {
    name: "user_roles",
    columns: [
      { name: "id", type: "uuid", nullable: false, default_value: "gen_random_uuid()" },
      { name: "user_id", type: "uuid", nullable: false, default_value: null },
      { name: "role", type: "app_role", nullable: false, default_value: null },
      { name: "created_at", type: "timestamptz", nullable: false, default_value: "now()" },
    ],
    policies: [],
    foreignKeys: [],
  },
];

// ═══ ENUMS ═══
const ENUMS = [
  { name: "app_role", values: ["icca_admin", "org_admin", "edital_manager", "proponente", "reviewer"] },
  { name: "edital_status", values: ["draft", "published", "closed", "em_avaliacao", "resultado_preliminar", "resultado_final", "homologado", "outorgado", "cancelado"] },
  { name: "field_type", values: ["text", "textarea", "number", "date", "file", "single_select", "multi_select", "checkbox", "radio", "email", "url", "phone", "currency"] },
  { name: "form_status", values: ["draft", "published", "archived"] },
  { name: "proposal_status", values: ["draft", "submitted", "under_review", "accepted", "rejected"] },
];

// ═══ FUNCTIONS ═══
const DB_FUNCTIONS: DbFunction[] = [
  { name: "ensure_default_membership", definition: `CREATE OR REPLACE FUNCTION public.ensure_default_membership()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.organization_members (user_id, organization_id, role)
  VALUES (auth.uid(), '00000000-0000-0000-0000-000000000001', 'proponente')
  ON CONFLICT DO NOTHING;
END;
$$;` },
  { name: "handle_new_user", definition: `CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.organization_members (user_id, organization_id, role)
  VALUES (NEW.id, '00000000-0000-0000-0000-000000000001', 'proponente')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;` },
  { name: "has_role", definition: `CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;` },
  { name: "has_org_role", definition: `CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND organization_id = _org_id AND role = _role)
$$;` },
  { name: "is_org_member", definition: `CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND organization_id = _org_id)
$$;` },
  { name: "is_reviewer_assigned", definition: `CREATE OR REPLACE FUNCTION public.is_reviewer_assigned(_user_id uuid, _proposal_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.review_assignments WHERE reviewer_user_id = _user_id AND proposal_id = _proposal_id)
$$;` },
  { name: "get_user_org_id", definition: `CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user_id LIMIT 1
$$;` },
  { name: "get_user_org_role", definition: `CREATE OR REPLACE FUNCTION public.get_user_org_role(_user_id uuid)
 RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT role FROM public.organization_members WHERE user_id = _user_id LIMIT 1
$$;` },
  { name: "get_proposal_anonymous_id", definition: `CREATE OR REPLACE FUNCTION public.get_proposal_anonymous_id(p_proposal_id uuid)
 RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT 'PROP-' || upper(substring(md5(p_proposal_id::text) from 1 for 8))
$$;` },
  { name: "generate_blind_code (trigger)", definition: `CREATE OR REPLACE FUNCTION public.generate_blind_code()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _prefix text; _strategy text; _blind_enabled boolean; _seq int;
BEGIN
  SELECT blind_review_enabled, blind_code_prefix, blind_code_strategy
  INTO _blind_enabled, _prefix, _strategy FROM editais WHERE id = NEW.edital_id;
  IF NOT COALESCE(_blind_enabled, true) THEN RETURN NEW; END IF;
  IF _prefix IS NULL OR _prefix = '' THEN _prefix := 'ED' || extract(year from now())::text; END IF;
  IF COALESCE(_strategy, 'sequential') = 'uuid_short' THEN
    NEW.blind_code := _prefix || '-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
  ELSE
    SELECT count(*) + 1 INTO _seq FROM proposals WHERE edital_id = NEW.edital_id AND blind_code IS NOT NULL;
    NEW.blind_code := _prefix || '-' || lpad(_seq::text, 3, '0');
  END IF;
  NEW.blind_code_generated_at := now();
  RETURN NEW;
END;
$$;` },
  { name: "generate_submission_protocol", definition: `CREATE OR REPLACE FUNCTION public.generate_submission_protocol(p_edital_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _seq INT; _edital_short TEXT;
BEGIN
  SELECT count(*) + 1 INTO _seq FROM edital_submissions WHERE edital_id = p_edital_id AND protocol IS NOT NULL;
  _edital_short := upper(substring(p_edital_id::text from 1 for 4));
  RETURN 'ED-' || extract(year from now())::text || '-' || _edital_short || '-' || lpad(_seq::text, 4, '0');
END;
$$;` },
  { name: "generate_form_code", definition: `CREATE OR REPLACE FUNCTION public.generate_form_code(p_org_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _seq int;
BEGIN
  SELECT count(*) + 1 INTO _seq FROM public.forms WHERE organization_id = p_org_id;
  RETURN 'FRM-' || lpad(_seq::text, 6, '0');
END;
$$;` },
  { name: "fn_audit_trigger", definition: `CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
-- Captures INSERT/UPDATE/DELETE on any table and writes to audit_logs.
-- Automatically extracts organization_id via direct column, edital_id, or proposal_id.
-- Records old/new status on UPDATE.` },
  { name: "prevent_audit_log_modification", definition: `CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
  RETURN NULL;
END;
$$;` },
  { name: "update_updated_at_column", definition: `CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;` },
  { name: "lookup_email_by_cpf_hash", definition: `CREATE OR REPLACE FUNCTION public.lookup_email_by_cpf_hash(p_cpf_hash text)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT email FROM profiles WHERE cpf_hash = p_cpf_hash LIMIT 1
$$;` },
  { name: "get_anonymized_proposal", definition: `CREATE OR REPLACE FUNCTION public.get_anonymized_proposal(p_assignment_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
-- Returns anonymized proposal data for a reviewer's assignment.
-- Includes: anonymous_id, edital_title, knowledge_area, answers, form_questions, files.
-- Validates that the caller owns the assignment.` },
];

// ═══ VIEW ═══
const VIEWS: ViewInfo[] = [
  {
    name: "submissions_blind",
    definition: `SELECT p.id AS submission_id, p.edital_id, p.blind_code, p.knowledge_area_id,
  ka.name AS knowledge_area_name, p.status, p.submitted_at, p.created_at,
  e.title AS edital_title, e.review_deadline, e.blind_review_enabled,
  pa.answers_json AS proposal_content
FROM proposals p
  LEFT JOIN knowledge_areas ka ON ka.id = p.knowledge_area_id
  LEFT JOIN editais e ON e.id = p.edital_id
  LEFT JOIN proposal_answers pa ON pa.proposal_id = p.id;`,
  },
];

// ═══ EDGE FUNCTIONS ═══
const EDGE_FUNCTIONS: EdgeFunction[] = [
  { name: "accept-reviewer-code", code: "Aceita convite de avaliador via código alfanumérico. Valida código, cria user (auth.admin.createUser), atualiza profiles, organization_members, user_roles, reviewer_profiles. Marca convite como usado." },
  { name: "accept-reviewer-invite", code: "Aceita convite de avaliador via token (link de email). Mesmo fluxo: valida token_hash, cria usuário, popula perfil, roles e reviewer_profiles." },
  { name: "export-audit-logs", code: "Exporta logs de auditoria em CSV ou HTML. Requer autenticação + role org_admin/edital_manager/icca_admin. Busca até 5000 registros com filtro por entidade." },
  { name: "generate-review-draft", code: "Gera minuta de parecer técnico usando IA (Lovable AI Gateway - gemini-3-flash-preview). Recebe scores, recomendação, conteúdo da proposta. Retorna stream SSE." },
  { name: "seed-cnpq-areas", code: "Popula tabela cnpq_areas com a árvore oficial de áreas do conhecimento do CNPq (9 grandes áreas + sub-áreas). ~500 registros." },
  { name: "seed-institutions", code: "Importa instituições do CSV do e-MEC para tabela institutions. Parsing de CSV, inserção em batch de 500." },
  { name: "send-reviewer-invite", code: "Envia e-mail de convite para avaliador via Resend. Gera token único, salva token_hash no invite, cria audit log. Template HTML com botão + código." },
  { name: "send-submission-notification", code: "Envia e-mail de confirmação de submissão via Resend. Inclui protocolo, título do edital, data. Template HTML estilizado." },
  { name: "validate-reviewer-code", code: "Valida código de convite alfanumérico. Rate-limit por IP (5 tentativas/min). Retorna dados do convite + organização sem consumir o convite." },
  { name: "validate-reviewer-invite", code: "Valida token de convite (link). Hash SHA-256, verifica expiração. Retorna dados do avaliador sem consumir o convite." },
];

/* ────────── COMPONENTS ────────── */

type SectionType = "tables" | "enums" | "functions" | "views" | "edge_functions";

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      {label && <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>}
      <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
        {code}
      </pre>
      <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleCopy}>
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function TableDetail({ table }: { table: TableInfo }) {
  const createSql = `CREATE TABLE public.${table.name} (\n${table.columns.map(c => `  ${c.name} ${c.type}${c.nullable ? "" : " NOT NULL"}${c.default_value ? ` DEFAULT ${c.default_value}` : ""}`).join(",\n")}\n);`;
  const rlsSql = table.policies.length > 0
    ? `ALTER TABLE public.${table.name} ENABLE ROW LEVEL SECURITY;\n\n${table.policies.map(p => `CREATE POLICY "${p.name}"\n  ON public.${table.name}\n  FOR ${p.command}\n  TO ${p.roles}${p.using ? `\n  USING (${p.using})` : ""}${p.with_check ? `\n  WITH CHECK (${p.with_check})` : ""};`).join("\n\n")}`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold font-heading flex items-center gap-2 mb-1">
          <Table className="h-5 w-5 text-primary" /> {table.name}
        </h2>
        <p className="text-sm text-muted-foreground">{table.columns.length} colunas · {table.policies.length} políticas RLS · {table.foreignKeys.length} FKs</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Database className="h-4 w-4" /> CREATE TABLE</h3>
        <CodeBlock code={createSql} />
      </div>

      {table.foreignKeys.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Foreign Keys</h3>
          <div className="space-y-1">
            {table.foreignKeys.map((fk, i) => (
              <p key={i} className="text-xs font-mono bg-muted/30 px-3 py-1.5 rounded">
                {table.name}.{fk.column} → {fk.refTable}.{fk.refColumn}
              </p>
            ))}
          </div>
        </div>
      )}

      {rlsSql && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Shield className="h-4 w-4 text-orange-500" /> RLS Policies ({table.policies.length})</h3>
          <CodeBlock code={rlsSql} />
        </div>
      )}

      {table.policies.length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          <p className="text-xs text-yellow-600 dark:text-yellow-400">⚠️ Nenhuma política RLS específica listada — verifique se RLS está habilitado e se há políticas definidas via funções auxiliares.</p>
        </div>
      )}
    </div>
  );
}

export default function SchemaDoc() {
  const [section, setSection] = useState<SectionType>("tables");
  const [selectedTable, setSelectedTable] = useState<string>(TABLES[0].name);
  const [selectedFn, setSelectedFn] = useState<string>(DB_FUNCTIONS[0].name);
  const [selectedEdge, setSelectedEdge] = useState<string>(EDGE_FUNCTIONS[0].name);
  const [selectedEnum, setSelectedEnum] = useState<string>(ENUMS[0]?.name ?? "");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<SectionType, boolean>>({
    tables: true, enums: false, functions: false, views: false, edge_functions: false,
  });

  const toggleSection = (s: SectionType) => {
    setExpandedSections(prev => ({ ...prev, [s]: !prev[s] }));
    setSection(s);
  };

  const sectionConfig: { key: SectionType; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "tables", label: "Tabelas", icon: <Table className="h-4 w-4" />, count: TABLES.length },
    { key: "enums", label: "Enums", icon: <Layers className="h-4 w-4" />, count: ENUMS.length },
    { key: "functions", label: "Funções DB", icon: <Code className="h-4 w-4" />, count: DB_FUNCTIONS.length },
    { key: "views", label: "Views", icon: <Eye className="h-4 w-4" />, count: VIEWS.length },
    { key: "edge_functions", label: "Edge Functions", icon: <Zap className="h-4 w-4" />, count: EDGE_FUNCTIONS.length },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-72" : "w-0"} transition-all duration-300 border-r border-border bg-card overflow-hidden flex-shrink-0`}>
        <div className="w-72">
          <div className="p-4 border-b border-border">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-3">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <h1 className="text-lg font-bold font-heading">📋 Schema Docs</h1>
            <p className="text-xs text-muted-foreground mt-1">ProjetoGO — Documentação do banco</p>
          </div>
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="p-2 space-y-1">
              {sectionConfig.map(({ key, label, icon, count }) => (
                <div key={key}>
                  <button
                    onClick={() => toggleSection(key)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${section === key ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}`}
                  >
                    {icon}
                    <span className="flex-1 text-left">{label}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
                    {expandedSections[key] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  {expandedSections[key] && (
                    <div className="ml-4 mt-1 space-y-0.5 max-h-64 overflow-y-auto">
                      {key === "tables" && TABLES.map(t => (
                        <button key={t.name} onClick={() => { setSection("tables"); setSelectedTable(t.name); }}
                          className={`w-full text-left text-xs px-3 py-1.5 rounded transition-colors truncate ${selectedTable === t.name && section === "tables" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>
                          {t.name}
                        </button>
                      ))}
                      {key === "functions" && DB_FUNCTIONS.map(f => (
                        <button key={f.name} onClick={() => { setSection("functions"); setSelectedFn(f.name); }}
                          className={`w-full text-left text-xs px-3 py-1.5 rounded transition-colors truncate ${selectedFn === f.name && section === "functions" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>
                          {f.name}
                        </button>
                      ))}
                      {key === "edge_functions" && EDGE_FUNCTIONS.map(e => (
                        <button key={e.name} onClick={() => { setSection("edge_functions"); setSelectedEdge(e.name); }}
                          className={`w-full text-left text-xs px-3 py-1.5 rounded transition-colors truncate ${selectedEdge === e.name && section === "edge_functions" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>
                          {e.name}
                        </button>
                      ))}
                      {key === "enums" && ENUMS.map(e => (
                        <button key={e.name} onClick={() => { setSection("enums"); setSelectedEnum(e.name); }}
                          className={`w-full text-left text-xs px-3 py-1.5 rounded transition-colors truncate ${selectedEnum === e.name && section === "enums" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>
                          {e.name}
                        </button>
                      ))}
                      {key === "views" && VIEWS.map(v => (
                        <div key={v.name} className="text-xs px-3 py-1.5 text-muted-foreground">{v.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Database className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold text-sm">
            {section === "tables" && `Tabela: ${selectedTable}`}
            {section === "enums" && `Enum: ${selectedEnum}`}
            {section === "functions" && `Função: ${selectedFn}`}
            {section === "views" && "Views"}
            {section === "edge_functions" && `Edge Function: ${selectedEdge}`}
          </h2>
        </div>

        <div className="p-6 max-w-4xl">
          {section === "tables" && (
            <TableDetail table={TABLES.find(t => t.name === selectedTable)!} />
          )}

          {section === "enums" && (() => {
            const enumItem = ENUMS.find(e => e.name === selectedEnum);
            if (!enumItem) return null;
            return (
              <div className="space-y-6">
                <h2 className="text-xl font-bold font-heading flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" /> {enumItem.name}
                </h2>
                <CodeBlock code={`CREATE TYPE public.${enumItem.name} AS ENUM (\n  ${enumItem.values.map(v => `'${v}'`).join(",\n  ")}\n);`} label={enumItem.name} />
                <div className="mt-4">
                  <h3 className="text-sm font-semibold mb-2">Valores ({enumItem.values.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {enumItem.values.map(v => (
                      <span key={v} className="px-2 py-1 bg-muted rounded text-xs font-mono">{v}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {section === "functions" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-heading flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" /> {selectedFn}
              </h2>
              <CodeBlock code={DB_FUNCTIONS.find(f => f.name === selectedFn)!.definition} />
            </div>
          )}

          {section === "views" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold font-heading flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" /> Views
              </h2>
              {VIEWS.map(v => (
                <div key={v.name}>
                  <CodeBlock code={`CREATE OR REPLACE VIEW public.${v.name} AS\n${v.definition}`} label={v.name} />
                </div>
              ))}
            </div>
          )}

          {section === "edge_functions" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-heading flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" /> {selectedEdge}
              </h2>
              <div className="bg-muted/30 border rounded-lg p-4">
                <p className="text-sm font-mono text-muted-foreground mb-2">supabase/functions/{selectedEdge}/index.ts</p>
                <p className="text-sm">{EDGE_FUNCTIONS.find(e => e.name === selectedEdge)!.code}</p>
              </div>
              <p className="text-xs text-muted-foreground">O código-fonte completo está em <code className="bg-muted px-1 py-0.5 rounded">supabase/functions/{selectedEdge}/index.ts</code></p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
