import { getDBSchema } from '../config/envConfig.js';

export function requestSchemaName(schema) {
  return String(schema ?? getDBSchema() ?? 'helloworldjunktest').replace(/"/g, '');
}

/** PostgreSQL enum type names (schema-qualified SQL cast targets). */
export const PG_ENUM_TYPE_NAMES = {
  approvalStatus: 'approval_status_enum',
  memberCategory: 'member_category_enum',
  photoType: 'photo_type_enum',
  requestStatus: 'request_status_enum',
  postingVisibility: 'posting_visibility_enum',
  soundPreference: 'sound_preference_enum',
  booleanEnum: 'boolean_enum'
};

export function approvalStatusEnumCast(schema) {
  return `"${requestSchemaName(schema)}".${PG_ENUM_TYPE_NAMES.approvalStatus}`;
}

export function memberCategoryEnumCast(schema) {
  return `"${requestSchemaName(schema)}".${PG_ENUM_TYPE_NAMES.memberCategory}`;
}

export function photoTypeEnumCast(schema) {
  return `"${requestSchemaName(schema)}".${PG_ENUM_TYPE_NAMES.photoType}`;
}

/** e.g. $3::"helloworldjunktest".photo_type_enum */
export function sqlEnumParamCast(paramRef, enumCast) {
  return `${paramRef}::${enumCast}`;
}

export function sqlApprovalStatusParam(paramRef, schema) {
  return sqlEnumParamCast(paramRef, approvalStatusEnumCast(schema));
}

export function sqlPhotoTypeParam(paramRef, schema) {
  return sqlEnumParamCast(paramRef, photoTypeEnumCast(schema));
}
