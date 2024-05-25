import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ITestController, ITestItem, IUri } from './types';
import { registerTestItemFile } from './helpers';

describe('registerTestItemFile', () => {
  const add = mock.fn((item: ITestItem): void => {});
  const get = mock.fn((itemId: string): ITestItem | undefined => undefined);
  const item: ITestItem = {};
  const createTestItem = mock.fn((id: string, label: string, uri?: IUri): ITestItem => item);
  const uri: IUri = {
    scheme: 'file',
    path: '/path/to/test/something_test.rego',
    toString: (): string => `file:///path/to/test/something_test.rego`,
  };
  const controller: ITestController = {
    createTestItem,
    items: {
      get,
      add,
    },
  };

  afterEach(() => {
    mock.reset();
  });

  it('returns the existing item', () => {
    // Arrange
    get.mock.mockImplementation((itemId: string): ITestItem | undefined => item);

    // Act
    const result = registerTestItemFile(controller, uri);

    // Assert
    assert.strictEqual(result, item);
  });

  it('returns the newly created item', () => {
    // Arrange & Act
    const result = registerTestItemFile(controller, uri);

    // Assert
    assert.ok(result);
    assert.strictEqual(createTestItem.mock.calls.length, 1, 'createTestItem should have been called once');
    assert.deepStrictEqual(createTestItem.mock.calls[0].arguments, [
      'file:///path/to/test/something_test.rego',
      'something_test.rego',
      uri,
    ]);
    assert.strictEqual(add.mock.calls.length, 1, 'add should have been called once');
    assert.deepStrictEqual(add.mock.calls[0].arguments, [result]);
  });
});
