import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeReadingSize } from './readingSize';

describe('reading size preference', () => {
  test('retains a selected size', () => assert.equal(normalizeReadingSize(125), 125));
  test('limits oversized saved values', () => assert.equal(normalizeReadingSize(200), 150));
  test('limits undersized saved values', () => assert.equal(normalizeReadingSize(20), 80));
  test('restores default for invalid values', () => assert.equal(normalizeReadingSize(NaN), 100));
});