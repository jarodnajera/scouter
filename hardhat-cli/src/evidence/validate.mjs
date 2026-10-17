// Deliberately limited validator for the schema vocabulary used in schemas/v1.mjs.
// Unsupported schema keywords fail closed. Not a general JSON Schema implementation.
const vocabulary = new Set(['$schema', '$id', 'type', 'properties', 'required', 'additionalProperties',
  'items', 'maxItems', 'minLength', 'maxLength', 'pattern', 'enum', 'minimum']);
export class ValidationError extends Error {
  constructor(message) { super(message); this.name = 'ValidationError'; }
}
export function validate(schema, value, path = '$', depth = 0) {
  if (depth > 64) throw new ValidationError('Maximum validation depth exceeded');
  for (const key of Object.keys(schema)) {
    if (!vocabulary.has(key)) throw new ValidationError(`Unsupported schema keyword: ${key}`);
  }
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (!types.some(t => t === actual || (t === 'integer' && Number.isSafeInteger(value)))) {
    throw new ValidationError(`${path}: expected ${types.join('|')}`);
  }
  if (schema.enum && !schema.enum.includes(value)) throw new ValidationError(`${path}: invalid enum value`);
  if (actual === 'string') {
    if (value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity)) {
      throw new ValidationError(`${path}: invalid string length`);
    }
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) throw new ValidationError(`${path}: invalid pattern`);
  }
  if (actual === 'number' && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity))) {
    throw new ValidationError(`${path}: invalid number`);
  }
  if (actual === 'array') {
    if (value.length > (schema.maxItems ?? Infinity)) throw new ValidationError(`${path}: too many items`);
    value.forEach((item, index) => validate(schema.items, item, `${path}[${index}]`, depth + 1));
  }
  if (actual === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new ValidationError(`${path}: expected plain object`);
    }
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) throw new ValidationError(`${path}.${key}: required`);
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties ?? {}, key)) {
        if (schema.additionalProperties === false) throw new ValidationError(`${path}: unexpected property`);
      } else validate(schema.properties[key], value[key], `${path}.${key}`, depth + 1);
    }
  }
  return value;
}
