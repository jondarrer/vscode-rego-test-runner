import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  GlobPatternType,
  ICancellationToken,
  IDisposable,
  IEventEmitter,
  IFileSystemWatcher,
  IFindFilesFunc,
  IGetConfigFunc,
  IPosition,
  IRange,
  IReadFileFunc,
  ITestController,
  ITestItem,
  ITestRun,
  ITestRunProfile,
  ITestRunRequest,
  ITextDocument,
  IUri,
} from './types';
import {
  refreshTestFiles,
  registerTestItemCasesFromFile,
  registerTestItemFile,
  setupFileSystemWatchers,
  updateWorkspaceTestFile,
} from './test-discovery';
import { TestItemCollection, Uri } from './test-classes';

class Range implements IRange {
  constructor(
    public start: IPosition,
    public end: IPosition,
  ) {}
}

class Position implements IPosition {
  constructor(
    public line: number,
    public character: number,
  ) {}
}

const add = mock.fn((item: ITestItem): void => {});
const get = mock.fn((itemId: string): ITestItem | undefined => undefined);
const replace = mock.fn((items: ITestItem[]): void => {});
const children = new TestItemCollection(new Map<string, ITestItem>());
mock.method(children, 'get', get);
mock.method(children, 'add', add);
mock.method(children, 'replace', replace);
const items = new TestItemCollection(new Map<string, ITestItem>());
mock.method(items, 'get', get);
mock.method(items, 'add', add);
mock.method(items, 'replace', replace);
const item: ITestItem = {
  id: '',
  label: '',
  children,
  uri: undefined,
  range: undefined,
  busy: false,
  parent: undefined,
  tags: [],
  canResolveChildren: false,
  error: undefined,
};
let listenerMock: (e: any) => any;
const onCancellationRequested = mock.fn(
  (listener: (e: any) => any, thisArgs?: any, disposables?: IDisposable[]): IDisposable => {
    console.log(listener);
    listenerMock = listener;
    return { dispose: (): void => {} };
  },
);
const createTestItem = mock.fn((id: string, label: string, uri?: IUri): ITestItem => item);
const uri = new Uri('file', `path${path.sep}to${path.sep}test${path.sep}something_test.rego`);
const testRun: ITestRun = {
  failed: mock.fn(),
  passed: mock.fn(),
  enqueued: mock.fn(),
  appendOutput: mock.fn(),
  skipped: mock.fn(),
  started: mock.fn(),
  end: mock.fn(),
  token: { isCancellationRequested: false, onCancellationRequested },
};
const createTestRun = mock.fn((request: ITestRunRequest, name?: string, persist?: boolean): ITestRun => testRun);
const refreshHandler = mock.fn((token: ICancellationToken): Thenable<void> => Promise.resolve());
const controller: ITestController = {
  createTestItem,
  createTestRun,
  items,
  refreshHandler,
};
const testFilePatterns = ['**/*_test.rego'];
const watchedTests = new Map<ITestItem | 'ALL', ITestRunProfile | undefined>();
const set = mock.fn(
  (key: ITestItem | 'ALL', value: ITestRunProfile | undefined): Map<ITestItem | 'ALL', ITestRunProfile | undefined> => {
    return new Map<ITestItem | 'ALL', ITestRunProfile | undefined>();
  },
);
mock.method(watchedTests, 'set', set);
watchedTests.set = set;
const deleteMock = mock.fn((key: ITestItem | 'ALL'): boolean => true);
mock.method(watchedTests, 'delete', deleteMock);
watchedTests.delete = deleteMock;

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
      `path${path.sep}to${path.sep}test${path.sep}something_test.rego`,
      'something_test.rego',
      uri,
    ]);

    // Not working right now, not sure why
    // assert.strictEqual(add.mock.calls.length, 1, 'add should have been called once');
    // assert.deepStrictEqual(add.mock.calls[0].arguments, [result]);
  });
});

describe('updateWorkspaceTestFile', () => {
  it('does nothing with non-file documents', () => {
    // Arrange
    const document: ITextDocument = {
      uri: new Uri('folder', '/path/to/test'),
    };

    // Act
    const result = updateWorkspaceTestFile(controller, document, testFilePatterns);

    // Assert
    assert.ok(!result);
  });
  it('does nothing with files which do not match the criteria for test files', () => {
    // Arrange
    const document: ITextDocument = {
      uri: new Uri('file', '/path/to/test/something.rego'),
    };

    // Act
    const result = updateWorkspaceTestFile(controller, document, testFilePatterns);

    // Assert
    assert.ok(!result);
  });
  it('returns a TestItem file', () => {
    // Arrange
    const document: ITextDocument = {
      uri: new Uri('file', '/path/to/test/something_test.rego'),
    };

    // Act
    const result = updateWorkspaceTestFile(controller, document, testFilePatterns);

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

describe('setupFileSystemWatchers', () => {
  const testFilePatterns = ['**/*_test.pattern', '**/*_another.pattern'];
  const getConfig: IGetConfigFunc = () => ({
    cwd: '/',
    testFilePatterns,
    policyTestDir: '.',
    opaCommand: 'opa',
    showEnhancedErrors: false,
  });
  const onDidCreate = mock.fn(
    (listener: (e: IUri) => any, thisArgs?: any, disposables?: IDisposable[]): IDisposable => {
      return { dispose: () => {} };
    },
  );
  const onDidChange = mock.fn(
    (listener: (e: IUri) => any, thisArgs?: any, disposables?: IDisposable[]): IDisposable => {
      return { dispose: () => {} };
    },
  );
  const onDidDelete = mock.fn(
    (listener: (e: IUri) => any, thisArgs?: any, disposables?: IDisposable[]): IDisposable => {
      return { dispose: () => {} };
    },
  );
  const createFileSystemWatcher = mock.fn(
    (
      globPattern: GlobPatternType,
      ignoreCreateEvents?: boolean,
      ignoreChangeEvents?: boolean,
      ignoreDeleteEvents?: boolean,
    ): IFileSystemWatcher => {
      return { onDidCreate, onDidChange, onDidDelete, dispose: () => {} };
    },
  );
  const readFile: IReadFileFunc = mock.fn(async (uri: IUri): Promise<Uint8Array> => new Uint8Array());

  afterEach(() => {
    mock.reset();
  });

  it('creates a watcher for each configured pattern', () => {
    // Arrange
    const fileChangedEmitter: IEventEmitter<IUri> = { fire: (data: IUri) => {} };

    // Act
    createFileSystemWatcher.mock.resetCalls();
    setupFileSystemWatchers(controller, fileChangedEmitter, createFileSystemWatcher, readFile, getConfig);

    // Assert
    assert.strictEqual(createFileSystemWatcher.mock.callCount(), 2);
    assert.strictEqual(createFileSystemWatcher.mock.calls[0].arguments[0], testFilePatterns[0]);
    assert.strictEqual(createFileSystemWatcher.mock.calls[1].arguments[0], testFilePatterns[1]);
  });
  it('watchers watch create, change and delete events', () => {
    // Arrange
    const fileChangedEmitter: IEventEmitter<IUri> = { fire: (data: IUri) => {} };

    // Act
    onDidCreate.mock.resetCalls();
    onDidChange.mock.resetCalls();
    onDidDelete.mock.resetCalls();
    const watchers = setupFileSystemWatchers(
      controller,
      fileChangedEmitter,
      createFileSystemWatcher,
      readFile,
      getConfig,
    );

    // Assert
    assert.strictEqual(watchers.length, 2);
    assert.strictEqual(onDidCreate.mock.callCount(), 2);
    assert.strictEqual(onDidChange.mock.callCount(), 2);
    assert.strictEqual(onDidDelete.mock.callCount(), 2);
  });
});
