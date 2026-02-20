import Database from "better-sqlite3";
import { products } from "./mock-data";

export function seedIfEmpty(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number }).c;
  if (count > 0) return;

  const insertProduct = db.prepare(`
    INSERT INTO products (id, active_substance, product_name, type, project_owner,
      submission_type, status, target_submission_date, data_responsibility,
      eu_approval_status, eu_expiry_date, conclusion)
    VALUES (@id, @active_substance, @product_name, @type, @project_owner,
      @submission_type, @status, @target_submission_date, @data_responsibility,
      @eu_approval_status, @eu_expiry_date, @conclusion)
  `);

  const insertAssessment = db.prepare(`
    INSERT INTO assessments (product_id, section_id, risk_level, summary, assessor,
      last_updated, details, use_outcomes)
    VALUES (@product_id, @section_id, @risk_level, @summary, @assessor,
      @last_updated, @details, @use_outcomes)
  `);

  const insertUse = db.prepare(`
    INSERT INTO gap_uses (id, product_id, country_code, description, notes)
    VALUES (@id, @product_id, @country_code, @description, @notes)
  `);

  const seed = db.transaction(() => {
    for (const product of products) {
      insertProduct.run({
        id: product.id,
        active_substance: product.activeSubstance,
        product_name: product.productName,
        type: product.type,
        project_owner: product.projectOwner,
        submission_type: product.submissionType,
        status: product.status,
        target_submission_date: product.targetSubmissionDate ?? null,
        data_responsibility: product.dataResponsibility,
        eu_approval_status: product.euApprovalStatus,
        eu_expiry_date: product.euExpiryDate ?? null,
        conclusion: product.conclusion ?? null,
      });

      for (const assessment of product.assessments) {
        insertAssessment.run({
          product_id: product.id,
          section_id: assessment.sectionId,
          risk_level: assessment.riskLevel,
          summary: assessment.summary,
          assessor: assessment.assessor ?? null,
          last_updated: assessment.lastUpdated ?? null,
          details: assessment.details ? JSON.stringify(assessment.details) : null,
          use_outcomes: assessment.useOutcomes ? JSON.stringify(assessment.useOutcomes) : null,
        });
      }

      for (const country of product.countries) {
        for (const use of country.uses) {
          insertUse.run({
            id: use.id,
            product_id: product.id,
            country_code: country.countryCode,
            description: use.description,
            notes: use.notes ?? null,
          });
        }
      }
    }
  });

  seed();
}
