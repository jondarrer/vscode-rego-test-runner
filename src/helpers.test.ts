import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { FindFilesFunc, ITestController, ITestItem, ITextDocument, IUri } from './types';
import { refreshTestFiles, registerTestItemFile, updateWorkspaceTestFile } from './helpers';

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

describe('registerTestItemFile', () => {
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

describe('updateWorkspaceTestFile', () => {
  it('does nothing with non-file documents', () => {
    // Arrange
    const document: ITextDocument = {
      uri: {
        scheme: 'folder',
        path: '/path/to/test',
        toString: (): string => `file:///path/to/test`,
      },
    };

    // Act
    const result = updateWorkspaceTestFile(controller, document);

    // Assert
    assert.ok(!result);
  });
  it('does nothing with files which do not match the criteria for test files', () => {
    // Arrange
    const document: ITextDocument = {
      uri: {
        scheme: 'file',
        path: '/path/to/test/something.rego',
        toString: (): string => `file:///path/to/test/something.rego`,
      },
    };

    // Act
    const result = updateWorkspaceTestFile(controller, document);

    // Assert
    assert.ok(!result);
  });
  it('returns a TestItem file', () => {
    // Arrange
    const document: ITextDocument = {
      uri: {
        scheme: 'file',
        path: '/path/to/test/something_test.rego',
        toString: (): string => `file:///path/to/test/something_test.rego`,
      },
    };

    // Act
    const result = updateWorkspaceTestFile(controller, document);

    // Assert
    assert.ok(result);
  });
});

describe('refreshTestFiles', () => {
  it('returns a list of TestItems for test files', async () => {
    // Arrange
    const other: IUri = {
      scheme: 'file',
      path: '/path/to/test/two/other_test.rego',
      toString: (): string => `file:///path/to/test/two/other_test.rego`,
    };
    const pattern = '**/*_test.rego';
    const findFiles: FindFilesFunc = mock.fn(async (pattern: string): Promise<IUri[]> => {
      return [uri, other];
    });

    // Act
    const result = await refreshTestFiles(controller, pattern, findFiles);

    // Assert
    assert.ok(result);
    assert.strictEqual(result.length, 2);
  });
});
