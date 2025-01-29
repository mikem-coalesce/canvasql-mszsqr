import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateTokens, verifyToken, refreshAccessToken } from '../../../src/core/utils/token.util';
import { IAuthTokens } from '../../../src/core/interfaces/auth.interface';
import { TokenType } from '../../../src/core/types/auth.types';
import jwt from 'jsonwebtoken';

describe('Token Utility Tests', () => {
  // Test environment setup
  const mockPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
    MIIEowIBAAKCAQEAvxxx...
    -----END RSA PRIVATE KEY-----`;
  
  const mockPublicKey = `-----BEGIN PUBLIC KEY-----
    MIIBIjANBgkqhkiG9w...
    -----END PUBLIC KEY-----`;

  const mockPayload = {
    userId: 'test-user-123',
    email: 'test@example.com',
    role: 'EDITOR'
  };

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = mockPrivateKey;
    process.env.JWT_REFRESH_SECRET = mockPrivateKey;
    process.env.JWT_PUBLIC_KEY = mockPublicKey;
  });

  afterEach(() => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_PUBLIC_KEY;
  });

  describe('generateTokens', () => {
    it('should generate valid access and refresh tokens', async () => {
      const tokens = await generateTokens(mockPayload);

      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(3600); // 1 hour
      expect(tokens.tokenType).toBe('Bearer');
    });

    it('should generate tokens using RS256 algorithm', async () => {
      const tokens = await generateTokens(mockPayload);
      const decodedAccess = jwt.decode(tokens.accessToken, { complete: true });
      const decodedRefresh = jwt.decode(tokens.refreshToken, { complete: true });

      expect(decodedAccess?.header.alg).toBe('RS256');
      expect(decodedRefresh?.header.alg).toBe('RS256');
    });

    it('should include correct claims in access token', async () => {
      const tokens = await generateTokens(mockPayload);
      const decoded = jwt.decode(tokens.accessToken) as Record<string, any>;

      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.role).toBe(mockPayload.role);
      expect(decoded.type).toBe(TokenType.ACCESS);
      expect(decoded.iss).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should throw error for invalid payload', async () => {
      const invalidPayload = { userId: 'test' }; // Missing required fields
      await expect(generateTokens(invalidPayload)).rejects.toThrow();
    });

    it('should generate unique tokens for each call', async () => {
      const tokens1 = await generateTokens(mockPayload);
      const tokens2 = await generateTokens(mockPayload);

      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe('verifyToken', () => {
    let validTokens: IAuthTokens;

    beforeEach(async () => {
      validTokens = await generateTokens(mockPayload);
    });

    it('should successfully validate a valid access token', async () => {
      const decoded = await verifyToken(validTokens.accessToken, TokenType.ACCESS);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.type).toBe(TokenType.ACCESS);
    });

    it('should successfully validate a valid refresh token', async () => {
      const decoded = await verifyToken(validTokens.refreshToken, TokenType.REFRESH);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.type).toBe(TokenType.REFRESH);
    });

    it('should reject expired tokens', async () => {
      // Create token that expires in 1 second
      const expiredToken = jwt.sign(
        { ...mockPayload, type: TokenType.ACCESS },
        mockPrivateKey,
        { algorithm: 'RS256', expiresIn: 1 }
      );

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      await expect(verifyToken(expiredToken, TokenType.ACCESS))
        .rejects.toThrow('Token has expired');
    });

    it('should reject tokens with invalid signature', async () => {
      const tamperedToken = validTokens.accessToken.slice(0, -5) + 'xxxxx';
      
      await expect(verifyToken(tamperedToken, TokenType.ACCESS))
        .rejects.toThrow('Invalid token signature');
    });

    it('should reject tokens with wrong type', async () => {
      await expect(verifyToken(validTokens.accessToken, TokenType.REFRESH))
        .rejects.toThrow('Invalid token type');
    });

    it('should reject empty tokens', async () => {
      await expect(verifyToken('', TokenType.ACCESS))
        .rejects.toThrow('Token is required');
    });
  });

  describe('refreshAccessToken', () => {
    let validTokens: IAuthTokens;

    beforeEach(async () => {
      validTokens = await generateTokens(mockPayload);
    });

    it('should generate new access token with valid refresh token', async () => {
      const newTokens = await refreshAccessToken(validTokens.refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(validTokens.accessToken);
      expect(newTokens.refreshToken).toBe(validTokens.refreshToken);
      expect(newTokens.expiresIn).toBe(3600);
    });

    it('should generate new token pair when refresh token is near expiry', async () => {
      // Create refresh token that expires in 23 hours
      const nearExpiryToken = jwt.sign(
        { ...mockPayload, type: TokenType.REFRESH },
        mockPrivateKey,
        { algorithm: 'RS256', expiresIn: 23 * 3600 }
      );

      const newTokens = await refreshAccessToken(nearExpiryToken);
      expect(newTokens.refreshToken).not.toBe(nearExpiryToken);
    });

    it('should reject refresh attempt with access token', async () => {
      await expect(refreshAccessToken(validTokens.accessToken))
        .rejects.toThrow('Invalid token type');
    });

    it('should reject refresh attempt with expired token', async () => {
      const expiredToken = jwt.sign(
        { ...mockPayload, type: TokenType.REFRESH },
        mockPrivateKey,
        { algorithm: 'RS256', expiresIn: 1 }
      );

      await new Promise(resolve => setTimeout(resolve, 1100));

      await expect(refreshAccessToken(expiredToken))
        .rejects.toThrow('Token has expired');
    });

    it('should reject refresh attempt with invalid signature', async () => {
      const tamperedToken = validTokens.refreshToken.slice(0, -5) + 'xxxxx';
      
      await expect(refreshAccessToken(tamperedToken))
        .rejects.toThrow('Invalid token signature');
    });
  });
});