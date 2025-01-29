import { describe, it, expect } from '@jest/globals';
import { z } from 'zod'; // v3.22.0
import { validateSchema, formatZodError, VALIDATION_ERROR_PREFIX, ValidationRules } from '@/core/utils/validation.util';
import { ValidationError } from '@/core/errors/ValidationError';

describe('validateSchema', () => {
  it('should validate correct data successfully', async () => {
    const schema = z.object({
      name: ValidationRules.string,
      email: ValidationRules.email,
      age: ValidationRules.positiveNumber
    });

    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 25
    };

    const result = await validateSchema(schema, validData);
    expect(result).toEqual(validData);
  });

  it('should throw ValidationError for invalid data', async () => {
    const schema = z.object({
      name: ValidationRules.string,
      email: ValidationRules.email,
      age: ValidationRules.positiveNumber
    });

    const invalidData = {
      name: 'Jo', // Too short
      email: 'not-an-email',
      age: -1
    };

    await expect(validateSchema(schema, invalidData))
      .rejects
      .toThrow(ValidationError);
  });

  it('should handle null/undefined input data', async () => {
    const schema = z.object({
      name: ValidationRules.string
    });

    await expect(validateSchema(schema, null))
      .rejects
      .toThrow(ValidationError);

    await expect(validateSchema(schema, undefined))
      .rejects
      .toThrow(ValidationError);
  });

  it('should validate complex nested schemas', async () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          name: ValidationRules.string,
          contact: z.object({
            email: ValidationRules.email
          })
        })
      })
    });

    const validData = {
      user: {
        profile: {
          name: 'John Doe',
          contact: {
            email: 'john@example.com'
          }
        }
      }
    };

    const result = await validateSchema(schema, validData);
    expect(result).toEqual(validData);
  });

  it('should validate arrays correctly', async () => {
    const schema = z.object({
      tags: ValidationRules.array(ValidationRules.string)
    });

    const validData = {
      tags: ['tag1', 'tag2', 'tag3']
    };

    const result = await validateSchema(schema, validData);
    expect(result).toEqual(validData);
  });

  it('should handle optional fields', async () => {
    const schema = z.object({
      name: ValidationRules.string,
      optional: ValidationRules.string.optional()
    });

    const validData = {
      name: 'John Doe'
    };

    const result = await validateSchema(schema, validData);
    expect(result).toEqual(validData);
  });

  it('should validate transformed values', async () => {
    const schema = z.object({
      name: ValidationRules.string.transform(s => s.toLowerCase()),
      age: z.string().transform(s => parseInt(s, 10))
    });

    const inputData = {
      name: 'JOHN DOE',
      age: '25'
    };

    const expectedData = {
      name: 'john doe',
      age: 25
    };

    const result = await validateSchema(schema, inputData);
    expect(result).toEqual(expectedData);
  });
});

describe('formatZodError', () => {
  it('should format single field error correctly', () => {
    const error = new z.ZodError([{
      code: 'invalid_type',
      expected: 'string',
      received: 'number',
      path: ['name'],
      message: 'Expected string, received number'
    }]);

    const formatted = formatZodError(error);
    expect(formatted).toHaveProperty('name');
    expect(formatted.name[0]).toContain(VALIDATION_ERROR_PREFIX);
  });

  it('should format multiple field errors correctly', () => {
    const error = new z.ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['name'],
        message: 'Expected string, received number'
      },
      {
        code: 'invalid_string',
        validation: 'email',
        path: ['email'],
        message: 'Invalid email'
      }
    ]);

    const formatted = formatZodError(error);
    expect(formatted).toHaveProperty('name');
    expect(formatted).toHaveProperty('email');
    expect(Object.keys(formatted)).toHaveLength(2);
  });

  it('should format nested field errors correctly', () => {
    const error = new z.ZodError([{
      code: 'invalid_type',
      expected: 'string',
      received: 'number',
      path: ['user', 'profile', 'name'],
      message: 'Expected string, received number'
    }]);

    const formatted = formatZodError(error);
    expect(formatted).toHaveProperty('user.profile.name');
  });

  it('should format array field errors correctly', () => {
    const error = new z.ZodError([{
      code: 'invalid_type',
      expected: 'string',
      received: 'number',
      path: ['tags', 0],
      message: 'Expected string, received number'
    }]);

    const formatted = formatZodError(error);
    expect(formatted).toHaveProperty('tags.0');
  });

  it('should handle root level errors', () => {
    const error = new z.ZodError([{
      code: 'invalid_type',
      expected: 'object',
      received: 'array',
      path: [],
      message: 'Expected object, received array'
    }]);

    const formatted = formatZodError(error);
    expect(formatted).toHaveProperty('_error');
  });

  it('should sort error messages for consistency', () => {
    const error = new z.ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['field'],
        message: 'Error B'
      },
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['field'],
        message: 'Error A'
      }
    ]);

    const formatted = formatZodError(error);
    expect(formatted.field[0]).toContain('Error A');
    expect(formatted.field[1]).toContain('Error B');
  });

  it('should prefix error messages correctly', () => {
    const error = new z.ZodError([{
      code: 'invalid_type',
      expected: 'string',
      received: 'number',
      path: ['field'],
      message: 'Custom error'
    }]);

    const formatted = formatZodError(error);
    expect(formatted.field[0]).toStartWith(VALIDATION_ERROR_PREFIX);
  });

  it('should not double-prefix messages that already have prefix', () => {
    const error = new z.ZodError([{
      code: 'invalid_type',
      expected: 'string',
      received: 'number',
      path: ['field'],
      message: `${VALIDATION_ERROR_PREFIX} Custom error`
    }]);

    const formatted = formatZodError(error);
    const prefixCount = formatted.field[0].split(VALIDATION_ERROR_PREFIX).length - 1;
    expect(prefixCount).toBe(1);
  });
});