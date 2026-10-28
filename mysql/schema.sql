-- RIMS 2022 MySQL schema. Run against the selected MySQL 8.0+ database.
-- This file intentionally replaces the previous PostgreSQL/Supabase schema.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  username VARCHAR(100) NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  construction_sector VARCHAR(160) NOT NULL,
  size_label VARCHAR(80) NULL,
  years_active INT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_organization_years CHECK (years_active IS NULL OR years_active BETWEEN 0 AND 200),
  KEY organizations_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'respondent',
  full_name VARCHAR(120) NOT NULL,
  job_title VARCHAR(120) NOT NULL,
  specialization VARCHAR(160) NULL,
  experience_years DECIMAL(5,1) NULL,
  risk_experience_years DECIMAL(5,1) NULL,
  erm_familiarity VARCHAR(40) NULL,
  consent_at DATETIME(3) NOT NULL,
  consent_version VARCHAR(30) NOT NULL DEFAULT '1.0',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_profiles_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_profiles_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT chk_profile_role CHECK (role IN ('respondent','admin')),
  CONSTRAINT chk_profile_experience CHECK (experience_years IS NULL OR experience_years BETWEEN 0 AND 80),
  CONSTRAINT chk_profile_risk_experience CHECK (risk_experience_years IS NULL OR risk_experience_years BETWEEN 0 AND 80),
  KEY profiles_org_role (organization_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invites (
  id CHAR(36) NOT NULL PRIMARY KEY,
  code_hash CHAR(64) NOT NULL UNIQUE,
  organization_id CHAR(36) NOT NULL,
  created_by CHAR(36) NULL,
  expires_at DATETIME(3) NOT NULL,
  used_by CHAR(36) NULL UNIQUE,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_invites_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_invites_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_invites_used_by FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY invites_expiry (expires_at, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dimensions (
  `key` VARCHAR(40) NOT NULL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  position INT NOT NULL UNIQUE,
  weight DECIMAL(5,4) NOT NULL,
  item_count INT NOT NULL,
  CONSTRAINT chk_dimension_weight CHECK (weight > 0 AND weight <= 1),
  CONSTRAINT chk_dimension_items CHECK (item_count > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questions (
  id VARCHAR(20) NOT NULL PRIMARY KEY,
  questionnaire_version VARCHAR(80) NOT NULL,
  position INT NOT NULL UNIQUE,
  dimension_key VARCHAR(40) NULL,
  kind VARCHAR(20) NOT NULL,
  text TEXT NOT NULL,
  original_number INT NULL,
  CONSTRAINT fk_questions_dimension FOREIGN KEY (dimension_key) REFERENCES dimensions(`key`),
  CONSTRAINT chk_question_kind CHECK (kind IN ('baseline','attribute','target')),
  CONSTRAINT chk_question_dimension CHECK ((kind='baseline' AND dimension_key IS NULL) OR (kind<>'baseline' AND dimension_key IS NOT NULL)),
  KEY questions_version_kind (questionnaire_version, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS answer_options (
  question_id VARCHAR(20) NOT NULL,
  option_index TINYINT NOT NULL,
  label VARCHAR(80) NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (question_id, option_index),
  CONSTRAINT fk_options_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT,
  CONSTRAINT chk_option_index CHECK (option_index BETWEEN 0 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  respondent_id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  questionnaire_version VARCHAR(80) NOT NULL DEFAULT 'rims-2022-fa-v1',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  submitted_at DATETIME(3) NULL,
  draft_respondent_id CHAR(36) GENERATED ALWAYS AS (CASE WHEN status='draft' THEN respondent_id ELSE NULL END) STORED,
  CONSTRAINT fk_assessments_profile FOREIGN KEY (respondent_id) REFERENCES profiles(id),
  CONSTRAINT fk_assessments_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT chk_assessment_status CHECK (status IN ('draft','submitted')),
  UNIQUE KEY only_one_draft_per_person (draft_respondent_id),
  KEY assessments_organization (organization_id, submitted_at),
  KEY assessments_respondent_started (respondent_id, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS answers (
  assessment_id CHAR(36) NOT NULL,
  question_id VARCHAR(20) NOT NULL,
  selected_index TINYINT NOT NULL,
  question_text_snapshot TEXT NOT NULL,
  option_label_snapshot VARCHAR(80) NOT NULL,
  option_text_snapshot TEXT NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (assessment_id, question_id),
  CONSTRAINT fk_answers_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_answers_question FOREIGN KEY (question_id) REFERENCES questions(id),
  CONSTRAINT chk_answer_selected CHECK (selected_index BETWEEN 0 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scoring_rules (
  id CHAR(36) NOT NULL PRIMARY KEY,
  label VARCHAR(180) NOT NULL,
  evidence_reference TEXT NOT NULL,
  evidence_kind VARCHAR(40) NOT NULL,
  boundaries JSON NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at DATETIME(3) NULL,
  approved_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  active_rules_slot TINYINT GENERATED ALWAYS AS (CASE WHEN is_active=TRUE THEN 1 ELSE NULL END) STORED,
  CONSTRAINT fk_scoring_rules_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_scoring_evidence CHECK (evidence_kind IN ('official_verified','research_decision')),
  UNIQUE KEY only_one_active_ruleset (active_rules_slot)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dimension_scores (
  assessment_id CHAR(36) NOT NULL,
  dimension_key VARCHAR(40) NOT NULL,
  average_score DECIMAL(14,8) NOT NULL,
  weighted_score DECIMAL(14,8) NOT NULL,
  item_count INT NOT NULL,
  algorithm_version VARCHAR(100) NOT NULL,
  calculated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (assessment_id, dimension_key),
  CONSTRAINT fk_dimension_scores_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id),
  CONSTRAINT fk_dimension_scores_dimension FOREIGN KEY (dimension_key) REFERENCES dimensions(`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS maturity_results (
  assessment_id CHAR(36) NOT NULL PRIMARY KEY,
  total_score DECIMAL(14,8) NOT NULL,
  tier VARCHAR(80) NULL,
  scoring_rules_id CHAR(36) NULL,
  algorithm_version VARCHAR(100) NOT NULL,
  calculated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_maturity_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id),
  CONSTRAINT fk_maturity_rules FOREIGN KEY (scoring_rules_id) REFERENCES scoring_rules(id) ON DELETE SET NULL,
  CONSTRAINT chk_maturity_score CHECK (total_score BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id CHAR(36) NULL,
  action VARCHAR(120) NOT NULL,
  entity_id VARCHAR(180) NULL,
  details JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY audit_created_at (created_at),
  KEY audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
