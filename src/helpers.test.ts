import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  IFindFilesFunc,
  IPosition,
  IRange,
  IReadFileFunc,
  ITestController,
  ITestItem,
  ITextDocument,
  IUri,
} from './types';
import {
  refreshTestFiles,
  registerTestItemCasesFromFile,
  registerTestItemFile,
  updateWorkspaceTestFile,
} from './helpers';

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

class Uri implements IUri {
  public authority: string;
  public query: string;
  public fragment: string;
  public fsPath: string;

  constructor(
    public scheme: string,
    public path: string
  ) {
    this.authority = '';
    this.query = '';
    this.fragment = '';
    this.fsPath = '';
  }
  toString() {
    return `${this.scheme}://${this.path}`;
  }
  with(change: IUri): IUri {
    return this;
  }
  toJSON(): any {
    return {
      scheme: this.scheme,
      path: this.path,
    };
  }
}

const add = mock.fn((item: ITestItem): void => {});
const get = mock.fn((itemId: string): ITestItem | undefined => undefined);
const replace = mock.fn((items: ITestItem[]): void => {});
const item: ITestItem = {
  children: {
    get,
    add,
    size: 0,
    replace,
  },
  uri: undefined,
  range: undefined,
};
const createTestItem = mock.fn((id: string, label: string, uri?: IUri): ITestItem => item);
const uri = new Uri('file', '/path/to/test/something_test.rego');
const controller: ITestController = {
  createTestItem,
  items: {
    get,
    add,
    size: 0,
    replace,
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
      uri: new Uri('folder', '/path/to/test'),
    };

    // Act
    const result = updateWorkspaceTestFile(controller, document);

    // Assert
    assert.ok(!result);
  });
  it('does nothing with files which do not match the criteria for test files', () => {
    // Arrange
    const document: ITextDocument = {
      uri: new Uri('file', '/path/to/test/something.rego'),
    };

    // Act
    const result = updateWorkspaceTestFile(controller, document);

    // Assert
    assert.ok(!result);
  });
  it('returns a TestItem file', () => {
    // Arrange
    const document: ITextDocument = {
      uri: new Uri('file', '/path/to/test/something_test.rego'),
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
    const other = new Uri('file', '/path/to/test/two/other_test.rego');
    const pattern = '**/*_test.rego';
    const findFiles: IFindFilesFunc = mock.fn(async (pattern: string): Promise<IUri[]> => {
      return [uri, other];
    });
    const readFile: IReadFileFunc = mock.fn(async (uri: IUri): Promise<Uint8Array> => new Uint8Array());

    // Act
    const result = await refreshTestFiles(controller, pattern, findFiles, readFile);

    // Assert
    assert.ok(result);
    assert.strictEqual(result.length, 2);
  });
});

describe('registerTestItemCasesFromFile', () => {
  it('returns an empty TestItemCollection for an empty file', () => {
    // Arrange
    const content = '';

    // Act
    const result = registerTestItemCasesFromFile(controller, item, content);

    // Assert
    assert.ok(result);
    assert.strictEqual(result.size, 0);
  });

  // Haven't got a proper mock for ITestItemCollection.size, which is why
  // this test is currently failing
  it.skip('returns a TestItemCollection for tests contained within a file', () => {
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
    }`;

    // Act
    const result = registerTestItemCasesFromFile(controller, item, content);

    // Assert
    assert.ok(result);
    assert.strictEqual(result.size, 3);
  });
});
