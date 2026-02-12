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
AS $$
DECLARE
  _action text;
  _entity_id uuid;
  _org_id uuid;
  _user_id uuid;
  _user_role text;
  _metadata jsonb;
BEGIN
  _action := TG_ARGV[0] || '.' || lower(TG_OP);

  IF TG_OP = 'DELETE' THEN _entity_id := OLD.id;
  ELSE _entity_id := NEW.id; END IF;

  _user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    BEGIN _org_id := OLD.organization_id; EXCEPTION WHEN undefined_column THEN _org_id := NULL; END;
  ELSE
    BEGIN _org_id := NEW.organization_id; EXCEPTION WHEN undefined_column THEN _org_id := NULL; END;
  END IF;

  IF _org_id IS NULL THEN
    BEGIN
      IF TG_OP = 'DELETE' THEN
        SELECT e.organization_id INTO _org_id FROM editais e WHERE e.id = OLD.edital_id;
      ELSE
        SELECT e.organization_id INTO _org_id FROM editais e WHERE e.id = NEW.edital_id;
      END IF;
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
  END IF;

  IF _org_id IS NULL THEN
    BEGIN
      IF TG_OP = 'DELETE' THEN
        SELECT p.organization_id INTO _org_id FROM proposals p WHERE p.id = OLD.proposal_id;
      ELSE
        SELECT p.organization_id INTO _org_id FROM proposals p WHERE p.id = NEW.proposal_id;
      END IF;
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
  END IF;

  IF _user_id IS NOT NULL THEN
    SELECT role::text INTO _user_role FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id LIMIT 1;
    IF _user_role IS NULL THEN
      SELECT role::text INTO _user_role FROM public.user_roles
      WHERE user_id = _user_id LIMIT 1;
    END IF;
  END IF;

  _metadata := '{}'::jsonb;
  IF TG_OP = 'UPDATE' THEN
    _metadata := jsonb_build_object('operation', 'update');
  ELSIF TG_OP = 'INSERT' THEN
    _metadata := jsonb_build_object('operation', 'insert');
  ELSIF TG_OP = 'DELETE' THEN
    _metadata := jsonb_build_object('operation', 'delete');
  END IF;

  IF TG_OP = 'UPDATE' THEN
    BEGIN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        _metadata := _metadata || jsonb_build_object('old_status', OLD.status::text, 'new_status', NEW.status::text);
      END IF;
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
  END IF;

  INSERT INTO public.audit_logs (user_id, organization_id, entity, entity_id, action, metadata_json, user_role)
  VALUES (_user_id, _org_id, TG_ARGV[0], _entity_id, _action, _metadata, _user_role);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;` },
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
AS $$
DECLARE
  _user_id uuid;
  _assignment record;
  _proposal record;
  _answers jsonb;
  _edital record;
  _area_name text;
  _files jsonb;
  _form_questions jsonb;
  _submission_answers jsonb;
  _result jsonb;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _assignment FROM review_assignments
  WHERE id = p_assignment_id AND reviewer_user_id = _user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found or not yours';
  END IF;

  SELECT id, edital_id, knowledge_area_id, status, created_at, blind_code, proponente_user_id
  INTO _proposal FROM proposals WHERE id = _assignment.proposal_id;

  SELECT title, blind_review_enabled, review_deadline INTO _edital
  FROM editais WHERE id = _proposal.edital_id;

  SELECT name INTO _area_name FROM knowledge_areas WHERE id = _proposal.knowledge_area_id;

  SELECT answers_json INTO _answers FROM proposal_answers WHERE proposal_id = _proposal.id;

  IF _answers IS NULL THEN
    SELECT es.answers INTO _submission_answers
    FROM edital_submissions es
    WHERE es.edital_id = _proposal.edital_id
      AND es.status = 'submitted'
      AND es.user_id = _proposal.proponente_user_id
    ORDER BY es.submitted_at DESC
    LIMIT 1;
    
    _answers := _submission_answers;
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'section_id', sub.section_id,
      'section_title', sub.section_title,
      'section_order', sub.section_order,
      'question_id', sub.question_id,
      'label', sub.label,
      'type', sub.type,
      'question_order', sub.question_order
    ) ORDER BY sub.section_order, sub.question_order
  ), '[]'::jsonb)
  INTO _form_questions
  FROM (
    SELECT fs.id as section_id, fs.title as section_title, fs.sort_order as section_order,
           fq.id as question_id, fq.label, fq.type, fq.sort_order as question_order
    FROM edital_forms ef
    JOIN form_sections fs ON fs.form_id = ef.id
    JOIN form_questions fq ON fq.form_id = ef.id AND (fq.section_id = fs.id OR fq.section_id IS NULL)
    WHERE ef.edital_id = _proposal.edital_id
    ORDER BY fs.sort_order, fq.sort_order
  ) sub;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', numbered.id,
    'file_type', numbered.file_type,
    'file_ref', 'Anexo_' || _proposal.blind_code || '_' || numbered.rn,
    'uploaded_at', numbered.uploaded_at
  )), '[]'::jsonb)
  INTO _files
  FROM (
    SELECT pf.id, pf.file_type, pf.uploaded_at,
           row_number() OVER (ORDER BY pf.uploaded_at) as rn
    FROM proposal_files pf WHERE pf.proposal_id = _proposal.id
  ) numbered;

  _result := jsonb_build_object(
    'anonymous_id', coalesce(_proposal.blind_code, get_proposal_anonymous_id(_proposal.id)),
    'edital_title', _edital.title,
    'blind_review', _edital.blind_review_enabled,
    'review_deadline', _edital.review_deadline,
    'knowledge_area', _area_name,
    'status', _proposal.status,
    'answers', _answers,
    'form_questions', _form_questions,
    'files', _files,
    'submitted_at', _proposal.created_at
  );

  RETURN _result;
END;
$$;` },
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
  { name: "accept-reviewer-code", code: `import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { invite_code, password, cpf, full_name, institution, institution_id, institution_custom_name, institution_type, areas, keywords, lattes_url } = await req.json();
    if (!invite_code || !password) throw new Error("Missing invite_code or password");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");
    if (!cpf || cpf.length !== 11) throw new Error("CPF is required (11 digits)");
    if (!full_name?.trim()) throw new Error("Full name is required");

    const code = invite_code.toUpperCase().trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Validate invite
    const { data: invite, error: inviteErr } = await adminClient
      .from("reviewer_invites").select("*").eq("invite_code", code).is("used_at", null).single();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Código não encontrado ou já utilizado." }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Este convite expirou." }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Hash CPF
    const cpfHash = await hashValue(cpf);
    const cpfLast4 = cpf.slice(-4);

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const email = invite.email;
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: full_name.trim() },
      });
      if (createErr) throw createErr;
      userId = newUser.user.id;
    }

    // Update profile with personal data + cpf_hash
    await adminClient.from("profiles").update({
      full_name: full_name.trim(),
      institution_id: institution_id || null,
      institution_custom_name: institution_custom_name || null,
      institution_type: institution_type || null,
      lattes_url: lattes_url || null,
      cpf: cpf,
      cpf_hash: cpfHash,
    }).eq("user_id", userId);

    // Add reviewer role in organization_members
    await adminClient.from("organization_members").upsert({
      user_id: userId, organization_id: invite.org_id, role: "reviewer", status: "ativo",
    }, { onConflict: "user_id,organization_id" }).select();

    // Add to user_roles
    await adminClient.from("user_roles").upsert({
      user_id: userId, role: "reviewer",
    }, { onConflict: "user_id,role" }).select();

    // Create reviewer_profiles entry
    await adminClient.from("reviewer_profiles").upsert({
      user_id: userId,
      org_id: invite.org_id,
      areas: areas && areas.length > 0 ? areas : (invite.areas || []),
      keywords: keywords && keywords.length > 0 ? keywords : (invite.keywords || []),
      orcid: invite.orcid || null,
      bio: null,
      accepted_at: new Date().toISOString(),
      first_terms_accepted_at: new Date().toISOString(),
      terms_version: "v1",
    }, { onConflict: "user_id,org_id" }).select();

    // Mark invite as used
    await adminClient.from("reviewer_invites").update({ used_at: new Date().toISOString() }).eq("id", invite.id);

    // Audit log
    await adminClient.from("audit_logs").insert({
      user_id: userId, organization_id: invite.org_id,
      entity: "reviewer", entity_id: userId,
      action: "REVIEWER_TERMS_ACCEPTED",
      metadata_json: { email, method: "invite_code", terms_version: "v1", lgpd_accepted: true },
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error accepting invite by code:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

async function hashValue(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(handler);` },
  { name: "accept-reviewer-invite", code: `import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, password, cpf } = await req.json();
    if (!token || !password) throw new Error("Missing token or password");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");
    if (!cpf || cpf.length !== 11) throw new Error("CPF is required (11 digits)");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const tokenHash = await hashToken(token);

    // Validate invite
    const { data: invite, error: inviteErr } = await adminClient
      .from("reviewer_invites").select("*").eq("token_hash", tokenHash).is("used_at", null).single();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Convite não encontrado ou já utilizado." }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Este convite expirou." }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Hash CPF
    const cpfHash = await hashToken(cpf);
    const cpfLast4 = cpf.slice(-4);

    // Use staging data from invite
    const fullName = invite.full_name || invite.email;

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === invite.email);

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: invite.email, password, email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createErr) throw createErr;
      userId = newUser.user.id;
    }

    // Update profile with personal data + cpf_hash
    await adminClient.from("profiles").update({
      full_name: fullName,
      institution_id: invite.institution_id || null,
      institution_custom_name: invite.institution_custom_name || null,
      institution_type: invite.institution_type || null,
      lattes_url: invite.lattes_url || null,
      cpf: cpf,
      cpf_hash: cpfHash,
    }).eq("user_id", userId);

    // Add reviewer role in organization_members
    await adminClient.from("organization_members").upsert({
      user_id: userId, organization_id: invite.org_id, role: "reviewer", status: "ativo",
    }, { onConflict: "user_id,organization_id" }).select();

    // Add to user_roles
    await adminClient.from("user_roles").upsert({
      user_id: userId, role: "reviewer",
    }, { onConflict: "user_id,role" }).select();

    // Create reviewer_profiles entry
    await adminClient.from("reviewer_profiles").upsert({
      user_id: userId,
      org_id: invite.org_id,
      areas: invite.areas || [],
      keywords: invite.keywords || [],
      orcid: invite.orcid || null,
      accepted_at: new Date().toISOString(),
      first_terms_accepted_at: new Date().toISOString(),
      terms_version: "v1",
    }, { onConflict: "user_id,org_id" }).select();

    // Mark invite as used
    await adminClient.from("reviewer_invites").update({ used_at: new Date().toISOString() }).eq("id", invite.id);

    // Audit log
    await adminClient.from("audit_logs").insert({
      user_id: userId, organization_id: invite.org_id,
      entity: "reviewer", entity_id: userId,
      action: "REVIEWER_TERMS_ACCEPTED",
      metadata_json: { email: invite.email },
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error accepting invite:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(handler);` },
  { name: "export-audit-logs", code: `import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get user token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user with anon client
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organization_id, format, entity_filter } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is org staff
    const adminClient = createClient(supabaseUrl, supabaseKey);
    const { data: membership } = await adminClient
      .from("organization_members").select("role")
      .eq("user_id", user.id).eq("organization_id", organization_id).single();

    const { data: globalRole } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "icca_admin").maybeSingle();

    const isStaff = globalRole || (membership && ["org_admin", "edital_manager"].includes(membership.role));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch logs
    let query = adminClient.from("audit_logs").select("*")
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false }).limit(5000);

    if (entity_filter) { query = query.eq("entity", entity_filter); }
    const { data: logs, error: logsError } = await query;
    if (logsError) throw logsError;

    // ... formats as CSV or HTML report with ENTITY_LABELS and ROLE_LABELS mappings
    // Returns Content-Disposition attachment for download

    if (format === "csv") {
      const header = "Data/Hora,Entidade,Ação,Papel,ID Entidade,Detalhes";
      const rows = (logs || []).map((log: any) => {
        const date = new Date(log.created_at).toLocaleString("pt-BR");
        const entity = log.entity;
        const action = log.action;
        const role = log.user_role || "Sistema";
        const entityId = log.entity_id || "";
        const meta = log.metadata_json ? JSON.stringify(log.metadata_json) : "";
        return \`"\${date}","\${entity}","\${action}","\${role}","\${entityId}","\${meta.replace(/"/g, '""')}"\`;
      });
      return new Response([header, ...rows].join("\\n"), {
        headers: { ...corsHeaders, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=audit-logs.csv" },
      });
    }

    // format === "pdf" returns styled HTML table
    return new Response(JSON.stringify({ error: "Formato inválido. Use 'csv' ou 'pdf'." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});` },
  { name: "generate-review-draft", code: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScoreInput {
  criteriaName: string;
  criteriaDescription: string | null;
  maxScore: number;
  weight: number;
  score: number;
  comment: string;
}

interface RequestBody {
  scores: ScoreInput[];
  recommendation: string;
  overallScore: number;
  knowledgeArea: string | null;
  editalTitle: string;
  proposalContent: Record<string, string> | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scores, recommendation, overallScore, knowledgeArea, editalTitle, proposalContent } =
      (await req.json()) as RequestBody;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const recommendationLabel: Record<string, string> = {
      approved: "Aprovado",
      approved_with_reservations: "Aprovado com ressalvas",
      not_approved: "Não aprovado",
    };

    const criteriaBlock = scores
      .map(s => \`- \${s.criteriaName} (peso \${s.weight}, máx \${s.maxScore}): nota \${s.score}\${s.comment ? \` — "\${s.comment}"\` : ""}\`)
      .join("\\n");

    const proposalBlock = proposalContent
      ? Object.entries(proposalContent).map(([k, v]) => \`\${k}: \${String(v).substring(0, 500)}\`).join("\\n")
      : "Conteúdo não disponível.";

    const systemPrompt = \`Você é um especialista acadêmico brasileiro que redige pareceres técnicos...
Regras: nunca mencionar nomes/instituições, usar código cego, linguagem formal acadêmica.
Estrutura: Introdução, Análise por Critério, Considerações Finais, Recomendação (300-600 palavras).\`;

    const userPrompt = \`Gere uma minuta de parecer para:
Edital: \${editalTitle} | Área: \${knowledgeArea || "N/A"}
Recomendação: \${recommendationLabel[recommendation] || recommendation}
Nota final: \${overallScore}
Critérios: \${criteriaBlock}
Proposta: \${proposalBlock}\`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: \`Bearer \${LOVABLE_API_KEY}\`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error: " + response.status);
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("generate-review-draft error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});` },
  { name: "seed-cnpq-areas", code: `import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CnpqEntry { code: string; name: string; level: number; parent_code: string | null; full_path: string; }

// Tabela oficial de Áreas do Conhecimento CNPq
const GRANDE_AREAS: Record<string, string> = {
  "10000003": "Ciências Exatas e da Terra",
  "20000006": "Ciências Biológicas",
  "30000009": "Engenharias",
  "40000001": "Ciências da Saúde",
  "50000005": "Ciências Agrárias",
  "60000008": "Ciências Sociais Aplicadas",
  "70000000": "Ciências Humanas",
  "80000002": "Linguística, Letras e Artes",
  "90000005": "Multidisciplinar",
};

// RAW_DATA: ~570 entradas no formato [code, name, parentCode]
// Inclui todas as 9 grandes áreas, áreas, subáreas e especialidades
// Exemplo: ["10100008", "Matemática", "10000003"], ["10101004", "Álgebra", "10100008"], ...
const RAW_DATA: [string, string, string | null][] = [
  // === GRANDE ÁREAS (9) ===
  ["10000003", "Ciências Exatas e da Terra", null],
  ["20000006", "Ciências Biológicas", null],
  // ... (+ ~568 registros de áreas, subáreas e especialidades)
  ["90500008", "Ciências Ambientais", "90000005"],
];

function determineLevel(code: string, parentCode: string | null): number {
  if (!parentCode) return 1;
  const parent = RAW_DATA.find(d => d[0] === parentCode);
  if (!parent || !parent[2]) return 2;
  const grandparent = RAW_DATA.find(d => d[0] === parent[2]);
  if (!grandparent || !grandparent[2]) return 3;
  return 4;
}

function buildFullPath(code: string): string {
  const entry = RAW_DATA.find(d => d[0] === code);
  if (!entry) return "";
  if (!entry[2]) return entry[1];
  return buildFullPath(entry[2]) + " > " + entry[1];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { count } = await supabase.from("cnpq_areas").select("*", { count: "exact", head: true });
    if (count && count > 0) {
      return new Response(JSON.stringify({ message: \`Already seeded with \${count} entries.\` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const entries: CnpqEntry[] = RAW_DATA.map(([code, name, parentCode]) => ({
      code, name, level: determineLevel(code, parentCode), parent_code: parentCode, full_path: buildFullPath(code),
    }));

    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const { error } = await supabase.from("cnpq_areas").insert(batch);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      inserted += batch.length;
    }

    return new Response(JSON.stringify({ message: \`Successfully seeded \${inserted} CNPq areas.\` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});` },
  { name: "seed-institutions", code: `import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { fields.push(current); current = ""; continue; }
    current += ch;
  }
  fields.push(current);
  return fields;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { count } = await supabase.from("institutions").select("*", { count: "exact", head: true });
    if (count && count > 0) {
      return new Response(JSON.stringify({ success: true, message: "Already seeded", count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { csvText } = await req.json();
    if (!csvText) throw new Error("csvText is required");

    const lines = csvText.split("\\n");
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const fields = parseCsvLine(line);
      const nome = fields[1]?.trim();
      if (!nome) continue;
      const sigla = fields[2]?.trim();
      rows.push({
        name: nome,
        sigla: sigla && sigla !== "null" ? sigla : null,
        category: fields[3]?.trim() || null,
        organization_type: fields[7]?.trim() || null,
        municipio: fields[9]?.trim() || null,
        uf: fields[10]?.trim() || null,
        is_active: fields[11]?.trim() === "Ativa",
        source: "eMEC",
      });
    }

    // Batch insert (500 por lote)
    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("institutions").insert(batch);
      if (error) throw error;
      inserted += batch.length;
    }

    return new Response(JSON.stringify({ success: true, inserted, total: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});` },
  { name: "send-reviewer-invite", code: `import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { inviteId, orgId, inviteCode } = await req.json();
    if (!inviteId || !orgId) throw new Error("Missing inviteId or orgId");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get invite with staging data
    const { data: invite, error: invErr } = await adminClient
      .from("reviewer_invites").select("*").eq("id", inviteId).eq("org_id", orgId).single();
    if (invErr || !invite) throw new Error("Invite not found");

    // Get org name
    const { data: org } = await adminClient.from("organizations").select("name").eq("id", orgId).single();

    // Generate token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const tokenHash = await hashToken(token);

    // Update invite with token
    await adminClient.from("reviewer_invites").update({ token_hash: tokenHash }).eq("id", inviteId);

    // If a custom invite code was provided, update it
    if (inviteCode) {
      await adminClient.from("reviewer_invites").update({ invite_code: inviteCode.toUpperCase().trim() }).eq("id", inviteId);
    }

    // Audit log
    await adminClient.from("audit_logs").insert({
      user_id: user.id, organization_id: orgId,
      entity: "reviewer", entity_id: inviteId,
      action: "REVIEWER_INVITE_SENT",
      metadata_json: { email: invite.email },
    });

    // Send email via Resend
    const fullName = invite.full_name || invite.email;
    const appUrl = req.headers.get("origin") || "https://proponente-pro.lovable.app";
    const inviteUrl = \`\${appUrl}/invite/reviewer?token=\${token}\`;
    const activateUrl = \`\${appUrl}/reviewer/activate\`;
    const codeDisplay = invite.invite_code || inviteCode || null;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "ProjetoGO <onboarding@resend.dev>",
        to: [invite.email],
        subject: \`Convite para Avaliador — \${org?.name || "ProjetoGO"}\`,
        html: \`<!-- Template HTML com botão "Aceitar Convite" + código alfanumérico -->\`,
      });
    }

    return new Response(JSON.stringify({ success: true, inviteUrl, inviteCode: codeDisplay }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending reviewer invite:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(handler);` },
  { name: "send-submission-notification", code: `import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationRequest {
  submissionId: string;
  protocol: string;
  editalTitle: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { submissionId, protocol, editalTitle }: NotificationRequest = await req.json();
    if (!submissionId || !protocol || !editalTitle) throw new Error("Missing required fields");

    // Get user profile
    const { data: profile } = await supabase.from("profiles")
      .select("full_name, email").eq("user_id", user.id).maybeSingle();

    const recipientEmail = profile?.email || user.email;
    const recipientName = profile?.full_name || "Proponente";
    if (!recipientEmail) throw new Error("No email found for user");

    const appUrl = req.headers.get("origin") || "https://proponente-pro.lovable.app";

    // Send email via Resend with styled HTML template
    // Includes: protocol number, edital title, submission date, CTA button
    await resend.emails.send({
      from: "ProjetoGO <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: \`Proposta submetida com sucesso — Protocolo \${protocol}\`,
      html: \`<!-- Template HTML estilizado com protocolo, edital, data -->\`,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);` },
  { name: "validate-reviewer-code", code: `import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limiting: 5 tentativas por IP por minuto
const attempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) { attempts.set(key, { count: 1, resetAt: now + 60_000 }); return true; }
  entry.count++;
  return entry.count <= 5;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { invite_code } = await req.json();
    if (!invite_code) throw new Error("Missing invite_code");

    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde 1 minuto." }), {
        status: 429, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const code = invite_code.toUpperCase().trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: invite, error } = await adminClient
      .from("reviewer_invites").select("*").eq("invite_code", code).is("used_at", null).single();

    if (error || !invite) {
      return new Response(JSON.stringify({ error: "Código não encontrado ou já utilizado." }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Este convite expirou." }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get org name
    const { data: org } = await adminClient.from("organizations").select("name").eq("id", invite.org_id).single();

    return new Response(JSON.stringify({
      invite: { id: invite.id, expires_at: invite.expires_at, org_id: invite.org_id },
      reviewer: { full_name: invite.full_name || null, email: invite.email, institution: invite.institution || null },
      org_name: org?.name || "",
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error validating code:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);` },
  { name: "validate-reviewer-invite", code: `import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token) throw new Error("Missing token");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const tokenHash = await hashToken(token);

    const { data: invite, error } = await adminClient
      .from("reviewer_invites").select("*").eq("token_hash", tokenHash).is("used_at", null).single();

    if (error || !invite) {
      return new Response(JSON.stringify({ error: "Convite não encontrado ou já utilizado." }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Este convite expirou." }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({
      invite: { id: invite.id, expires_at: invite.expires_at },
      reviewer: { full_name: invite.full_name || null, email: invite.email, institution: invite.institution || null },
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error validating invite:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(handler);` },
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
  const [selectedView, setSelectedView] = useState<string>(VIEWS[0]?.name ?? "");
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
                        <button key={v.name} onClick={() => { setSection("views"); setSelectedView(v.name); }}
                          className={`w-full text-left text-xs px-3 py-1.5 rounded transition-colors truncate ${selectedView === v.name && section === "views" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>
                          {v.name}
                        </button>
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
            {section === "views" && `View: ${selectedView}`}
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

          {section === "views" && (() => {
            const view = VIEWS.find(v => v.name === selectedView);
            if (!view) return null;
            return (
              <div className="space-y-4">
                <h2 className="text-xl font-bold font-heading flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" /> {view.name}
                </h2>
                <CodeBlock code={`CREATE OR REPLACE VIEW public.${view.name} AS\n${view.definition}`} />
              </div>
            );
          })()}

          {section === "edge_functions" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-heading flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" /> {selectedEdge}
              </h2>
              <p className="text-xs text-muted-foreground font-mono">supabase/functions/{selectedEdge}/index.ts</p>
              <CodeBlock code={EDGE_FUNCTIONS.find(e => e.name === selectedEdge)!.code} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
