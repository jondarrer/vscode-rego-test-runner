import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { textOutputParser } from './text-output-parser';
import { IOpaTestResult, IUri } from './types';
import { getExpectedResult, getTestingData, Uri } from './testing-utils';

describe('textOutputParser', () => {
  const cwd = '/path/to';
  const uri: IUri = new Uri('file', '/path/to/sample/policies/sample/sample_test.rego');

  it('parses passed tests', () => {
    // Arrange
    const output = getTestingData('passed');
    const expected = getExpectedResult('passed') as IOpaTestResult[];

    // Act
    const results = textOutputParser(output, cwd, uri);

    // Assert
    for (let i = 0; i < expected.length; i++) {
      const testId = `${expected[i].package}.${expected[i].name}`;
      assert.strictEqual((results as Map<string, IOpaTestResult>).has(testId), true);
      assert.deepStrictEqual((results as Map<string, IOpaTestResult>).get(testId), expected[i]);
    }
  });
  it('parses failed tests', () => {
    // Arrange
    const output = getTestingData('failed');
    const expected = getExpectedResult('failed') as IOpaTestResult[];

    // Act
    const results = textOutputParser(output, cwd, uri);

    // Assert
    for (let i = 0; i < expected.length; i++) {
      const testId = `${expected[i].package}.${expected[i].name}`;
      assert.strictEqual(results.has(testId), true);
      assert.deepStrictEqual(results.get(testId), expected[i]);
    }
  });
  it('parses errored tests', () => {
    // Arrange
    const output = getTestingData('errored');
    const expected = getExpectedResult('errored') as { message: string };

    // Act & Assert
    assert.throws(() => textOutputParser(output, cwd, uri), new Error(expected.message));
  });
  it('parses duplicates tests', () => {
    // Arrange
    const output = getTestingData('duplicates');
    const expected = getExpectedResult('duplicates') as IOpaTestResult[];

    // Act
    const results = textOutputParser(output, cwd, uri);

    // Assert
    for (let i = 0; i < expected.length; i++) {
      const testId = `${expected[i].package}.${expected[i].name}`;
      assert.strictEqual(results.has(testId), true);
      assert.deepStrictEqual(results.get(testId), expected[i]);
    }
  });
  it('parses mixed tests', () => {
    // Arrange
    const output = getTestingData('mixed');
    const expected = getExpectedResult('mixed') as IOpaTestResult[];

    // Act
    const results = textOutputParser(output, cwd, uri);

    // Assert
    for (let i = 0; i < expected.length; i++) {
      const testId = `${expected[i].package}.${expected[i].name}`;
      assert.strictEqual(results.has(testId), true);
      assert.deepStrictEqual(results.get(testId), expected[i]);
    }
  });
  it('parses no tests tests', () => {
    // Arrange
    const output = getTestingData('no_tests');
    const expected = getExpectedResult('no_tests') as IOpaTestResult[];

    // Act
    const results = textOutputParser(output, cwd, uri);

    // Assert
    assert.strictEqual(results.size, expected.length);
  });
  it('parses todo tests', () => {
    // Arrange
    const output = getTestingData('todo');
    const expected = getExpectedResult('todo') as IOpaTestResult[];

    // Act
    const results = textOutputParser(output, cwd, uri);

    // Assert
    for (let i = 0; i < expected.length; i++) {
      const testId = `${expected[i].package}.${expected[i].name}`;
      assert.strictEqual(results.has(testId), true);
      assert.deepStrictEqual(results.get(testId), expected[i]);
    }
  });
  it('parses all tests', () => {
    // Arrange
    const output = getTestingData('all');
    const expected = getExpectedResult('all') as IOpaTestResult[];

    // Act
    const results = textOutputParser(output, cwd, uri);

    // Assert
    for (let i = 0; i < expected.length; i++) {
      const testId = `${expected[i].package}.${expected[i].name}`;
      assert.strictEqual(results.has(testId), true, `should have result for test "${testId}"`);
      assert.deepStrictEqual(results.get(testId), expected[i]);
    }
  });
});
