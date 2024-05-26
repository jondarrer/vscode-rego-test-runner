import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { IPosition, IRange } from './types';
import { regoTestFileParser } from './rego-test-file-parser';

const onTestHandler = mock.fn((testName: string, range: IRange): void => {});

class Range implements IRange {
  constructor(
    public start: IPosition,
    public end: IPosition
  ) {}
}

class Position implements IPosition {
  constructor(
    public line: number,
    public character: number
  ) {}
}

afterEach(() => {
  mock.reset();
});

describe('regoTestFileParser', () => {
  it('finds no tests in an empty file', () => {
    // Arrange
    const content = '';

    // Act
    regoTestFileParser(content, onTestHandler, Range, Position);

    // Assert
    assert.strictEqual(onTestHandler.mock.calls.length, 0);
  });
  it('finds no tests in a file with content', () => {
    // Arrange
    const content = `package sample

import rego.v1`;

    // Act
    regoTestFileParser(content, onTestHandler, Range, Position);

    // Assert
    assert.strictEqual(onTestHandler.mock.calls.length, 0);
  });
  it('finds no tests in a file with the word test in it, but not in the correct place', () => {
    // Arrange
    const content = `package sample_test

import rego.v1

import data.sample`;

    // Act
    regoTestFileParser(content, onTestHandler, Range, Position);

    // Assert
    assert.strictEqual(onTestHandler.mock.calls.length, 0);
  });
  it('finds tests in a file with tests in it', () => {
    // Arrange
    const content = `package sample_test

import rego.v1

import data.sample

test_post_allowed if {
	sample.allow with input as {"path": ["users"], "method": "POST"}
}

test_get_anonymous_denied if {
	not sample.allow with input as {"path": ["users"], "method": "GET"}
}

test_get_user_allowed if {
	sample.allow with input as {"path": ["users", "bob"], "method": "GET", "user_id": "bob"}
}

not_a_test_get_another_user_denied if {
}

not_a_test_either if {
  test_not
}`;

    // Act
    regoTestFileParser(content, onTestHandler, Range, Position);

    // Assert
    assert.strictEqual(onTestHandler.mock.calls.length, 3);
  });
});
