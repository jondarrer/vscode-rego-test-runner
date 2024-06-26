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
  INote,
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
  getRelativePath,
  getParentItem,
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

const cwd = '';
const uri = new Uri('file', `path${path.sep}to${path.sep}test${path.sep}something_test.rego`);
const children = new TestItemCollection(new Map<string, ITestItem>());
const items = new TestItemCollection(new Map<string, ITestItem>());
const item: ITestItem = {
  id: uri.fsPath,
  label: uri.fsPath.split(path.sep).pop() || '',
  children,
  uri,
  range: undefined,
  busy: false,
  parent: undefined,
  tags: [],
  canResolveChildren: false,
  error: undefined,
};
let listenerMock: (e: any) => any;
const onCancellationRequested = mock.fn(
  (listener: (e: any) => any, _thisArgs?: any, _disposables?: IDisposable[]): IDisposable => {
    listenerMock = listener;
    return { dispose: (): void => {} };
  },
);
const createTestItem = mock.fn(
  (id: string, label: string, uri?: IUri): ITestItem => ({
    id,
    label,
    children: new TestItemCollection(new Map<string, ITestItem>()),
    uri,
    range: undefined,
    busy: false,
    parent: undefined,
    tags: [],
    canResolveChildren: false,
    error: undefined,
  }),
);
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
const createTestRun = mock.fn((_request: ITestRunRequest, _name?: string, _persist?: boolean): ITestRun => testRun);
const refreshHandler = mock.fn((_token: ICancellationToken): Thenable<void> => Promise.resolve());
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
  createTestItem.mock.resetCalls();
  controller.items.forEach((item) => controller.items.delete(item.id));
});

describe('registerTestItemFile', () => {
  it('returns the existing item', () => {
    // Arrange
    controller.items.add(item);

    // Act
    const result = registerTestItemFile(controller, cwd, item.uri || uri);

    // Assert
    assert.strictEqual(result, item);
  });

  it('returns the newly created item', () => {
    // Arrange & Act
    const result = registerTestItemFile(controller, cwd, uri);

    // Assert
    assert.ok(result);
    assert.strictEqual(
      createTestItem.mock.calls.length > 0,
      true,
      'createTestItem should have been called at least once',
    );
    assert.deepStrictEqual(createTestItem.mock.calls[0].arguments, [
      `path${path.sep}to${path.sep}test${path.sep}something_test.rego`,
      'something_test.rego',
      uri,
    ]);
    assert.strictEqual(result.id, uri.fsPath);
  });
});

describe('updateWorkspaceTestFile', () => {
  it('does nothing with non-file documents', () => {
    // Arrange
    const document: ITextDocument = {
      uri: new Uri('folder', '/path/to/test'),
    };

    // Act
    const result = updateWorkspaceTestFile(controller, document, testFilePatterns, cwd);

    // Assert
    assert.ok(!result);
  });
  it('does nothing with files which do not match the criteria for test files', () => {
    // Arrange
    const document: ITextDocument = {
      uri: new Uri('file', '/path/to/test/something.rego'),
    };

    // Act
    const result = updateWorkspaceTestFile(controller, document, testFilePatterns, cwd);

    // Assert
    assert.ok(!result);
  });
  it('returns a TestItem file', () => {
    // Arrange
    const document: ITextDocument = {
      uri: new Uri('file', '/path/to/test/something_test.rego'),
    };

    // Act
    const result = updateWorkspaceTestFile(controller, document, testFilePatterns, cwd);

    // Assert
    assert.ok(result);
  });
});

describe('refreshTestFiles', () => {
  it('returns a list of TestItems for test files', async () => {
    // Arrange
    const notes: INote[] = [];
    const other = new Uri('file', '/path/to/test/two/other_test.rego');
    const pattern = '**/*_test.rego';
    const findFiles: IFindFilesFunc = mock.fn(async (pattern: string): Promise<IUri[]> => {
      return [uri, other];
    });
    const readFile: IReadFileFunc = mock.fn(async (uri: IUri): Promise<Uint8Array> => new Uint8Array());

    // Act
    const result = await refreshTestFiles(controller, pattern, findFiles, readFile, notes, cwd);

    // Assert
    assert.ok(result);
    assert.strictEqual(result.length, 2);
  });
});

describe('registerTestItemCasesFromFile', () => {
  it('returns an empty TestItemCollection for an empty file', () => {
    // Arrange
    const notes: INote[] = [];
    const content = '';

    // Act
    const result = registerTestItemCasesFromFile(controller, item, content, notes);

    // Assert
    assert.ok(result);
    assert.strictEqual(result.size, 0);
  });

  it('returns a TestItemCollection for tests contained within a file', () => {
    // Arrange
    const notes: INote[] = [];
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
    const result = registerTestItemCasesFromFile(controller, item, content, notes);

    // Assert
    assert.ok(result);
    assert.strictEqual(result.size, 3);
  });

  it('Adds a "duplicate" note when identically named tests are contained within the same file', () => {
    const notes: INote[] = [];
    const content = `package sample_test

import rego.v1

import data.sample

test_post_allowed if {
  sample.allow with input as {"path": ["users"], "method": "POST"}
}

test_post_allowed if {
  sample.allow with input as {"path": ["users"], "method": "POST"}
}`;

    // Act
    const result = registerTestItemCasesFromFile(controller, item, content, notes);

    // Assert
    assert.ok(result);
    assert.strictEqual(notes.length, 1);
    assert.strictEqual(notes[0].type, 'duplicate');
  });
});

describe('setupFileSystemWatchers', () => {
  const testFilePatterns = ['**/*_test.pattern', '**/*_another.pattern'];
  const getConfig: IGetConfigFunc = () => ({
    cwd: '/',
    testFilePatterns,
    policyTestDir: '.',
    policyTestPath: '',
    opaCommand: 'opa',
    showEnhancedErrors: true,
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
      _globPattern: GlobPatternType,
      _ignoreCreateEvents?: boolean,
      _ignoreChangeEvents?: boolean,
      _ignoreDeleteEvents?: boolean,
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
    const notes: INote[] = [];
    const fileChangedEmitter: IEventEmitter<IUri> = { fire: (data: IUri) => {} };

    // Act
    createFileSystemWatcher.mock.resetCalls();
    setupFileSystemWatchers(controller, fileChangedEmitter, createFileSystemWatcher, readFile, getConfig, notes);

    // Assert
    assert.strictEqual(createFileSystemWatcher.mock.callCount(), 2);
    assert.strictEqual(createFileSystemWatcher.mock.calls[0].arguments[0], testFilePatterns[0]);
    assert.strictEqual(createFileSystemWatcher.mock.calls[1].arguments[0], testFilePatterns[1]);
  });
  it('watchers watch create, change and delete events', () => {
    // Arrange
    const notes: INote[] = [];
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
      notes,
    );

    // Assert
    assert.strictEqual(watchers.length, 2);
    assert.strictEqual(onDidCreate.mock.callCount(), 2);
    assert.strictEqual(onDidChange.mock.callCount(), 2);
    assert.strictEqual(onDidDelete.mock.callCount(), 2);
  });
});

describe('getRelativePath', () => {
  it('gets path/to/file.rego from /absolute/path/to/file.rego', () => {
    // Arrange
    const dir = '/absolute';
    const uri = new Uri('file', '/absolute/path/to/file.rego');

    // Act
    const result = getRelativePath(dir, uri);

    // Assert
    assert.strictEqual(result, 'path/to/file.rego');
  });
});

describe('getParentItem', () => {
  it.skip('gets existing items [path]->[path/to] for relative path path/to/file.rego', () => {
    // Arrange
    const dir = '/absolute';
    const uri = new Uri('file', '/absolute/path/to/file.rego');

    // Act
    const result = getParentItem(controller, dir, uri);

    // Assert
    assert.ok(result);
    assert.strictEqual(result.id, '/absolute/path/to');
    assert.strictEqual(result.label, 'to');
    assert.ok(result.parent);
    assert.strictEqual(result.parent.id, '/absolute/path');
    assert.strictEqual(result.parent.label, 'path');
  });
  it.skip('gets existing items [path]->[path/to] for relative path file.rego', () => {
    // Arrange
    const dir = '/absolute';
    const uri = new Uri('file', '/absolute/file.rego');

    // Act
    const result = getParentItem(controller, dir, uri);

    // Assert
    assert.ok(result);
    assert.strictEqual(result.id, '/absolute');
    assert.strictEqual(result.label, 'absolute');
    assert.strictEqual(controller.items.size, 1);
  });
  it.skip('creates items [path]->[path/to] for relative path path/to/file.rego', () => {
    // Arrange
    const dir = '/absolute';
    const uri = new Uri('file', '/absolute/path/to/file.rego');

    // Act
    const result = getParentItem(controller, dir, uri);

    // Assert
    assert.ok(result);
    assert.strictEqual(result.id, '/absolute/path/to');
    assert.strictEqual(result.label, 'to');
    assert.ok(result.parent);
    assert.strictEqual(result.parent.id, '/absolute/path');
    assert.strictEqual(result.parent.label, 'path');
  });
});
