/**
 * Middleware factory: validate req.body against a small schema.
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
 * Behaviour:
 *   - Collects ALL errors (does not fail-fast)
 *   - On failure: forwards a 400 error with `details: [{field, message}]`
 *   - On success: replaces req.body with the sanitised object and calls next()
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const body = req.body ?? {};
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

    if (errors.length) {
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
