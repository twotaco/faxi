/**
 * Unit tests for Autonomous Navigator Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { autonomousNavigatorService } from './autonomousNavigatorService.js';

describe('AutonomousNavigatorService', () => {
  describe('generateTestData', () => {
    it('should generate email test data', () => {
      const data = autonomousNavigatorService.generateTestData('email');
      expect(data).toContain('@');
      expect(data).toContain('example.com');
    });

    it('should generate password test data', () => {
      const data = autonomousNavigatorService.generateTestData('password');
      expect(data).toBeTruthy();
      expect(data.length).toBeGreaterThan(8);
    });

    it('should generate name test data', () => {
      const data = autonomousNavigatorService.generateTestData('name');
      expect(data).toContain('Test');
    });

    it('should generate phone test data', () => {
      const data = autonomousNavigatorService.generateTestData('phone');
      expect(data).toMatch(/\d/);
    });

    it('should use hint when field type is not recognized', () => {
      const data = autonomousNavigatorService.generateTestData('unknown', 'email address');
      expect(data).toContain('@');
    });

    it('should return default value for unknown field type', () => {
      const data = autonomousNavigatorService.generateTestData('unknown');
      expect(data).toBe('Test Value');
    });
  });

  // Note: Browser-dependent tests (findAndClick, fillField, etc.) would require
  // a running browser instance and are better suited for integration tests.
  // These tests focus on the logic that doesn't require browser automation.
});
