import { z } from "zod";

const shortText = z.string().max(255).nullable().optional();
const timestamp = z.string().max(64).nullable().optional();
const optionalNumber = z.number().finite().nullable().optional();

export const partMasterSchema = z.object({
  ID: z.number().int().optional(),
  description: shortText,
  is_assembly: z.boolean().optional(),
  is_buy: z.boolean().optional(),
  part_number: z.string().min(1).max(255),
  rev: shortText,
  status: z.enum(["Active", "Inactive"]).optional(),
  updated_on: timestamp,
});

export const planSchema = z.object({
  ID: z.number().int(),
  approval_status: shortText,
  customer_name: shortText,
  is_spec_lib: z.boolean().optional(),
  is_tabulated: z.boolean().optional(),
  operation: shortText,
  part_description: shortText,
  part_number: z.string().min(1).max(255),
  project_identifier: shortText,
  rev: shortText,
  status: shortText,
  supplier_name: shortText,
  supplier_number: shortText,
  updated_on: timestamp,
  version: optionalNumber,
  version_status: shortText,
});

const specificationSchema = z.object({
  characteristic: shortText,
  characteristic_type: shortText,
  data_type: shortText,
  dimension_type: shortText,
  inspection_method: shortText,
  is_key: z.boolean().optional(),
  label: shortText,
  lower_spec_limit: optionalNumber,
  nominal: optionalNumber,
  operation: shortText,
  sampling_rule: shortText,
  unit: shortText,
  upper_spec_limit: optionalNumber,
});

export const planDetailSchema = planSchema.extend({
  specifications: z.array(specificationSchema).max(500).optional(),
});

const qualityRecordBase = z.object({
  ID: z.number().int(),
  closed_on: timestamp,
  created_on: timestamp,
  customer_name: shortText,
  inspection_status: shortText,
  operation: shortText,
  part_description: shortText,
  part_number: z.string().min(1).max(255),
  project_identifier: shortText,
  rev: shortText,
  review_status: shortText,
  site: shortText,
  supplier_name: shortText,
  supplier_number: shortText,
  updated_on: timestamp,
});

export const inspectionSchema = qualityRecordBase.extend({
  in_spec_pct: optionalNumber,
  insp_ident_1: shortText,
  insp_ident_2: shortText,
  insp_ident_3: shortText,
  inspection_type: shortText,
  lot_size: optionalNumber,
  parts_failed: optionalNumber,
  parts_passed: optionalNumber,
});

export const inspectionDetailSchema = inspectionSchema.extend({
  specifications: z.array(specificationSchema).max(500).optional(),
});

export const faiSchema = qualityRecordBase.extend({
  fai_type: z.enum(["Standard", "AS9102"]).optional(),
  in_spec_pct: optionalNumber,
  insp_ident_1: shortText,
  insp_ident_2: shortText,
  insp_ident_3: shortText,
  number_of_parts: optionalNumber,
});

export const faiDetailSchema = faiSchema.extend({
  specifications: z.array(specificationSchema).max(500).optional(),
});

export const supplierSchema = z.object({
  ID: z.number().int(),
  commodity_codes: z.array(z.string().max(255)).max(100).optional(),
  direct: z.boolean().optional(),
  indirect: z.boolean().optional(),
  last_qualification_date: timestamp,
  name: z.string().min(1).max(255),
  organization_codes: z.array(z.string().max(255)).max(100).optional(),
  qualification_status: shortText,
  re_qualification_date: timestamp,
  small_business: z.boolean().optional(),
  strategic: z.boolean().optional(),
  vendor_code: shortText,
});

export const qmsRecordSchema = z.object({
  ID: z.number().int(),
  capa_required: z.boolean().optional(),
  closed_on: timestamp,
  complaint_on: timestamp,
  created_on: timestamp,
  customer_name: shortText,
  date_due: timestamp,
  defective_quantity: optionalNumber,
  detected_at: shortText,
  impact: shortText,
  inspection_quantity: optionalNumber,
  lot_quantity: optionalNumber,
  number: optionalNumber,
  part_description: shortText,
  part_number: shortText,
  problem_summary: z.string().max(4000).nullable().optional(),
  problem_type: shortText,
  rev: shortText,
  root_cause: z.string().max(4000).nullable().optional(),
  source: z.enum(["Customer", "Field"]).optional(),
  status: shortText,
  supplier_name: shortText,
  task_count: optionalNumber,
  task_status: shortText,
  type: shortText,
  updated_on: timestamp,
});

export const boundedList = <T extends z.ZodType>(schema: T) =>
  z.array(schema).max(100);
