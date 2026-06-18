/**
 * Per-asset-type field registry. The source of truth now lives in `@org/dto`
 * so the API (statement-extraction guidance + sanitisation) and the app share
 * one definition. Re-exported here so existing feature imports stay stable.
 */
export {
  ASSET_TYPE_FIELDS,
  assetDetailGuidance,
  metaForType,
  sanitizeDetails,
  type AssetFieldDef,
  type AssetFieldType,
  type AssetTypeMeta,
} from '@org/dto';
