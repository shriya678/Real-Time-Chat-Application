/**
 * Pure validation function. No req/res dependency — reusable across
 * HTTP routes and socket handlers.
 *
 * Schema shape:
 *   {
 *     fieldName: {
 *       required?: boolean,
 *       type?: 'string',            // only 'string' supported today
 *       trim?: boolean,             // applied before length checks
 *       minLength?: number,
 *       maxLength?: number,
 *     }
 *   }
 *
 * Returns: { valid: boolean, errors: Array<{field, message}>, sanitized: object }
 */
export function validate(schema, data) {
  const body = data ?? {};
  const errors = [];
  const sanitized = {};

  for (const [field, rules] of Object.entries(schema)) {
    let value = body[field];

    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '');

    if (isEmpty) {
      if (rules.required) {
        errors.push({ field, message: `${field} is required` });
      }
      continue;
    }

    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push({ field, message: `${field} must be a string` });
      continue;
    }

    if (rules.trim && typeof value === 'string') {
      value = value.trim();
    }

    if (typeof value === 'string') {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push({
          field,
          message: `${field} must be at least ${rules.minLength} character(s)`,
        });
        continue;
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push({
          field,
          message: `${field} must be at most ${rules.maxLength} character(s)`,
        });
        continue;
      }
    }

    sanitized[field] = value;
  }

  return { valid: errors.length === 0, errors, sanitized };
}

/**
 * Express middleware factory that runs `validate` on req.body.
 * On failure: forwards a 400 error with `details[]` to the central handler.
 * On success: replaces req.body with the sanitized version and calls next().
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const { valid, errors, sanitized } = validate(schema, req.body);

    if (!valid) {
      const err = new Error('Validation failed');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      err.details = errors;
      return next(err);
    }

    req.body = sanitized;
    return next();
  };
}
