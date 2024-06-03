import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { textOutputParser } from './text-output-parser';
import { IOpaTestResult, IUri } from './types';
import { Uri } from './test-classes';

const OUTPUT_TEST_PASSED = `sample/policies/sample/sample_test.rego:
data.sample_test.test_post_allowed: PASS (7.445541ms)
--------------------------------------------------------------------------------
PASS: 1/1`;

const OUTPUT_TEST_FAILED = `FAILURES
--------------------------------------------------------------------------------
data.sample_test.test_post_allowed: FAIL (4981.375µs)

  query:1                                       Enter data.sample_test.test_post_allowed = _
  sample/policies/sample/sample_test.rego:7     | Enter data.sample_test.test_post_allowed
  sample/policies/sample/sample_test.rego:8     | | Fail not data.sample.allow with input as {"method": "POST", "path": ["users"]}
  query:1                                       | Fail data.sample_test.test_post_allowed = _

SUMMARY
--------------------------------------------------------------------------------
sample/policies/sample/sample_test.rego:
data.sample_test.test_post_allowed: FAIL (4981.375µs)
--------------------------------------------------------------------------------
FAIL: 1/1`;

const OUTPUT_TEST_ERRORED = `1 error occurred during loading: sample/policies/sample/sample_test.rego:8: rego_parse_error: unexpected identifier token: expected \n or ; or }
no sample.allow with input as {"path": ["users"], "method": "POST"}
   ^`;

const RESULT_TEST_PASSED: IOpaTestResult = {
  location: {
    file: 'sample/policies/sample/sample_test.rego',
  },
  package: 'data.sample_test',
  name: 'test_post_allowed',
  duration: 7.445541,
};

const RESULT_TEST_FAILED: IOpaTestResult = {
  location: {
    file: 'sample/policies/sample/sample_test.rego',
  },
  package: 'data.sample_test',
  name: 'test_post_allowed',
  fail: true,
  duration: 4.981375,
  output: `data.sample_test.test_post_allowed: FAIL (4981.375µs)

  query:1                                       Enter data.sample_test.test_post_allowed = _
  sample/policies/sample/sample_test.rego:7     | Enter data.sample_test.test_post_allowed
  sample/policies/sample/sample_test.rego:8     | | Fail not data.sample.allow with input as {"method": "POST", "path": ["users"]}
  query:1                                       | Fail data.sample_test.test_post_allowed = _`,
};

const RESULT_TEST_ERRORED: IOpaTestResult = {
  location: {
    file: 'sample/policies/sample/sample_test.rego',
  },
  package: 'data.sample_test',
  name: 'test_post_allowed',
  fail: true,
  duration: 0,
  output: `1 error occurred during loading: sample/policies/sample/sample_test.rego:8: rego_parse_error: unexpected identifier token: expected \n or ; or }
no sample.allow with input as {"path": ["users"], "method": "POST"}
   ^`,
};

describe('textOutputParser', () => {
  const cwd = '/path/to';
  const uri: IUri = new Uri('file', '/path/to/sample/policies/sample/sample_test.rego');
  const testId = 'data.sample_test.test_post_allowed';

  it('parses a passed test', () => {
    // Arrange & Act
    const results = textOutputParser(OUTPUT_TEST_PASSED, cwd, uri, testId);

    // Assert
    assert.ok(results);
    assert.strictEqual(results.length, 1);
    assert.deepStrictEqual(results[0], RESULT_TEST_PASSED);
  });
  it('parses a failed test', () => {
    // Arrange & Act
    const results = textOutputParser(OUTPUT_TEST_FAILED, cwd, uri, testId);

    // Assert
    assert.ok(results);
    assert.strictEqual(results.length, 1);
    assert.deepStrictEqual(results[0], RESULT_TEST_FAILED);
  });
  it('parses an errored test', () => {
    // Arrange & Act
    const results = textOutputParser(OUTPUT_TEST_ERRORED, cwd, uri, testId);

    // Assert
    assert.ok(results);
    assert.strictEqual(results.length, 1);
    assert.deepStrictEqual(results[0], RESULT_TEST_ERRORED);
  });
});
