import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { hashPassword, verifyPassword } from '@/core/utils/encryption.util';
import { APIError } from '@/core/errors/APIError';

// Test constants
const TEST_PASSWORD = 'TestP@ssw0rd123!';
const INVALID_HASH = 'invalid_hash_format';
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

describe('hashPassword', () => {
  // Store original environment
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  test('should successfully hash a valid password with Argon2id', async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  test('should generate hash with correct Argon2id format and parameters', async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    expect(hash).toMatch(/^\$argon2id\$v=\d+\$/);
    // Verify presence of memory cost, iterations, parallelism, salt, and hash
    expect(hash).toMatch(/m=\d+,t=\d+,p=\d+\$/);
  });

  test('should throw APIError.badRequest for empty password', async () => {
    await expect(hashPassword('')).rejects.toThrow(APIError);
    await expect(hashPassword('')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid password input'
    });
  });

  test('should throw APIError.badRequest for null/undefined password', async () => {
    // @ts-expect-error Testing invalid input
    await expect(hashPassword(null)).rejects.toThrow(APIError);
    // @ts-expect-error Testing invalid input
    await expect(hashPassword(undefined)).rejects.toThrow(APIError);
  });

  test('should generate different hashes for identical passwords', async () => {
    const hash1 = await hashPassword(TEST_PASSWORD);
    const hash2 = await hashPassword(TEST_PASSWORD);
    expect(hash1).not.toBe(hash2);
  });

  test('should handle special characters correctly', async () => {
    const specialPassword = '!@#$%^&*()`~[]{}\\|;:\'"<>,.?/';
    const hash = await hashPassword(specialPassword);
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });

  test('should apply pepper when configured in environment', async () => {
    process.env.PASSWORD_PEPPER = 'test_pepper';
    const hashWithPepper = await hashPassword(TEST_PASSWORD);
    
    // Reset pepper
    process.env.PASSWORD_PEPPER = '';
    const hashWithoutPepper = await hashPassword(TEST_PASSWORD);
    
    expect(hashWithPepper).not.toBe(hashWithoutPepper);
  });

  test('should handle non-string input types', async () => {
    // @ts-expect-error Testing invalid input
    await expect(hashPassword(123)).rejects.toThrow(APIError);
    // @ts-expect-error Testing invalid input
    await expect(hashPassword({})).rejects.toThrow(APIError);
    // @ts-expect-error Testing invalid input
    await expect(hashPassword([])).rejects.toThrow(APIError);
  });
});

describe('verifyPassword', () => {
  // Store original environment
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  test('should return true for correct password verification', async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    const isValid = await verifyPassword(TEST_PASSWORD, hash);
    expect(isValid).toBe(true);
  });

  test('should return false for incorrect password', async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    const isValid = await verifyPassword('WrongPassword123!', hash);
    expect(isValid).toBe(false);
  });

  test('should throw APIError.badRequest for empty password or hash', async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    await expect(verifyPassword('', hash)).rejects.toThrow(APIError);
    await expect(verifyPassword(TEST_PASSWORD, '')).rejects.toThrow(APIError);
  });

  test('should throw APIError.badRequest for invalid hash format', async () => {
    await expect(verifyPassword(TEST_PASSWORD, INVALID_HASH)).rejects.toThrow(APIError);
  });

  test('should handle special characters in verification', async () => {
    const specialPassword = '!@#$%^&*()`~[]{}\\|;:\'"<>,.?/';
    const hash = await hashPassword(specialPassword);
    const isValid = await verifyPassword(specialPassword, hash);
    expect(isValid).toBe(true);
  });

  test('should verify passwords with pepper when configured', async () => {
    process.env.PASSWORD_PEPPER = 'test_pepper';
    const hash = await hashPassword(TEST_PASSWORD);
    const isValid = await verifyPassword(TEST_PASSWORD, hash);
    expect(isValid).toBe(true);
  });

  test('should handle non-string input types', async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    // @ts-expect-error Testing invalid input
    await expect(verifyPassword(123, hash)).rejects.toThrow(APIError);
    // @ts-expect-error Testing invalid input
    await expect(verifyPassword(TEST_PASSWORD, 123)).rejects.toThrow(APIError);
  });

  test('should maintain constant-time comparison', async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    
    // Measure verification time for correct password
    const startCorrect = process.hrtime.bigint();
    await verifyPassword(TEST_PASSWORD, hash);
    const endCorrect = process.hrtime.bigint();
    const correctTime = Number(endCorrect - startCorrect);

    // Measure verification time for incorrect password
    const startIncorrect = process.hrtime.bigint();
    await verifyPassword('WrongPassword123!', hash);
    const endIncorrect = process.hrtime.bigint();
    const incorrectTime = Number(endIncorrect - startIncorrect);

    // Verify timing difference is within acceptable range (50% tolerance)
    const timingDifference = Math.abs(correctTime - incorrectTime) / correctTime;
    expect(timingDifference).toBeLessThan(0.5);
  });
});