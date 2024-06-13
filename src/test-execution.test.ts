import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import { handleRunRequest, placeTestsInQueue } from './test-execution';
import {
  ICancellationToken,
  IDisposable,
  IGetConfigFunc,
  ITestController,
  ITestItem,
  ITestRun,
  ITestRunProfile,
  ITestRunRequest,
  IUri,
} from './types';
import { TestItemCollection, Uri } from './testing-utils';

let listenerMock: (e: any) => any;
const onCancellationRequested = mock.fn(
  (listener: (e: any) => any, _thisArgs?: any, _disposables?: IDisposable[]): IDisposable => {
    listener;
    listenerMock = listener;
    return { dispose: (): void => {} };
  },
);
const add = mock.fn((_item: ITestItem): void => {});
const get = mock.fn((_itemId: string): ITestItem | undefined => undefined);
const replace = mock.fn((_items: ITestItem[]): void => {});
const items = new TestItemCollection(new Map<string, ITestItem>());
mock.method(items, 'get', get);
mock.method(items, 'add', add);
mock.method(items, 'replace', replace);
const children = new TestItemCollection(new Map<string, ITestItem>());
mock.method(children, 'get', get);
mock.method(children, 'add', add);
mock.method(children, 'replace', replace);
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
const testRun: ITestRun = {
  failed: mock.fn(),
  passed: mock.fn(),
  enqueued: mock.fn(),
  appendOutput: mock.fn(),
  skipped: mock.fn(),
  started: mock.fn(),
  end: mock.fn(),
  token: {
    isCancellationRequested: false,
    onCancellationRequested: mock.fn(
      (listener: (e: any) => any, _thisArgs?: any, _disposables?: IDisposable[]): IDisposable => ({
        dispose: (): void => {},
      }),
    ),
  },
};
const createTestItem = mock.fn((_id: string, _label: string, _uri?: IUri): ITestItem => item);
const createTestRun = mock.fn((_request: ITestRunRequest, _name?: string, _persist?: boolean): ITestRun => testRun);
const refreshHandler = mock.fn((_token: ICancellationToken): Thenable<void> => Promise.resolve());
const controller: ITestController = {
  createTestItem,
  createTestRun,
  items,
  refreshHandler,
};
const watchedTests = new Map<ITestItem | 'ALL', ITestRunProfile | undefined>();
const set = mock.fn(
  (
    _key: ITestItem | 'ALL',
    _value: ITestRunProfile | undefined,
  ): Map<ITestItem | 'ALL', ITestRunProfile | undefined> => {
    return new Map<ITestItem | 'ALL', ITestRunProfile | undefined>();
  },
);
mock.method(watchedTests, 'set', set);
watchedTests.set = set;
const deleteMock = mock.fn((_key: ITestItem | 'ALL'): boolean => true);
mock.method(watchedTests, 'delete', deleteMock);
watchedTests.delete = deleteMock;

const fItem1: ITestItem = {
  id: '/abc',
  children: new TestItemCollection(new Map<string, ITestItem>()),
  uri: new Uri('file', '/abc'),
  label: 'abc',
  range: undefined,
  busy: false,
  parent: undefined,
  tags: [],
  canResolveChildren: false,
  error: undefined,
};
const tcItem1: ITestItem = {
  id: '/abc/1',
  children: new TestItemCollection(new Map<string, ITestItem>()),
  uri: new Uri('file', '/abc'),
  label: '1',
  range: undefined,
  busy: false,
  parent: fItem1,
  tags: [],
  canResolveChildren: false,
  error: undefined,
};
const tcItem2: ITestItem = {
  id: '/abc/2',
  children: new TestItemCollection(new Map<string, ITestItem>()),
  uri: new Uri('file', '/abc'),
  label: '2',
  range: undefined,
  busy: false,
  parent: fItem1,
  tags: [],
  canResolveChildren: false,
  error: undefined,
};
const tcItem3: ITestItem = {
  id: '/def/3',
  children: new TestItemCollection(new Map<string, ITestItem>()),
  uri: new Uri('file', '/def'),
  label: '3',
  range: undefined,
  busy: false,
  parent: undefined,
  tags: [],
  canResolveChildren: false,
  error: undefined,
};
fItem1.children.add(tcItem1);
fItem1.children.add(tcItem2);

describe('handleRunRequest', () => {
  const getConfig: IGetConfigFunc = () => ({
    cwd: '/',
    testFilePatterns: [],
    policyTestDir: '.',
    opaCommand: 'opa',
    showEnhancedErrors: false,
  });

  it('should start running tests if an ad-hoc (non-continuous) request is made', () => {
    // Arrange
    const request: ITestRunRequest = {
      include: undefined,
      exclude: undefined,
      continuous: false,
      profile: undefined,
    };
    const cancellation: ICancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested,
    };

    // Act
    handleRunRequest(controller, request, cancellation, getConfig, watchedTests);

    // Assert
    assert.strictEqual(createTestRun.mock.callCount(), 1, 'createTestRun should have been called');
  });

  it('should set key ALL in watchedTests when all tests are requested to be watched', () => {
    // Arrange
    const profile: ITestRunProfile = {};
    const request: ITestRunRequest = {
      include: undefined,
      exclude: undefined,
      continuous: true,
      profile,
    };
    const cancellation: ICancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested,
    };

    // Act
    set.mock.resetCalls();
    watchedTests.set = set;
    handleRunRequest(controller, request, cancellation, getConfig, watchedTests);

    // Assert
    assert.strictEqual(set.mock.callCount(), 1);
    assert.strictEqual(set.mock.calls[0].arguments[0], 'ALL');
    assert.strictEqual(set.mock.calls[0].arguments[1], profile);
  });

  it('should set keys in watchedTests when specific tests are requested to be watched', () => {
    // Arrange
    const profile: ITestRunProfile = {};
    const request: ITestRunRequest = {
      include: [item],
      exclude: undefined,
      continuous: true,
      profile,
    };
    const cancellation: ICancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested,
    };

    // Act
    set.mock.resetCalls();
    watchedTests.set = set;
    handleRunRequest(controller, request, cancellation, getConfig, watchedTests);

    // Assert
    assert.strictEqual(set.mock.callCount(), 1);
    assert.strictEqual(set.mock.calls[0].arguments[0], item);
    assert.strictEqual(set.mock.calls[0].arguments[1], profile);
  });

  it('should not start running tests if a watch (continuous) request is made', () => {
    // Arrange
    const request: ITestRunRequest = {
      include: undefined,
      exclude: undefined,
      continuous: true,
      profile: undefined,
    };
    const cancellation: ICancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested,
    };

    // Act
    createTestRun.mock.resetCalls();
    handleRunRequest(controller, request, cancellation, getConfig, watchedTests);

    // Assert
    assert.strictEqual(createTestRun.mock.callCount(), 0, 'createTestRun should not have been called');
  });

  it('should delete key ALL in watchedTests when watched tests are cancelled', async () => {
    // Arrange
    const profile: ITestRunProfile = {};
    const request: ITestRunRequest = {
      include: undefined,
      exclude: undefined,
      continuous: true,
      profile,
    };
    const cancellation: ICancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested,
    };

    // Act
    set.mock.resetCalls();
    deleteMock.mock.resetCalls();
    watchedTests.set = set;
    watchedTests.delete = deleteMock;
    handleRunRequest(controller, request, cancellation, getConfig, watchedTests);
    listenerMock({});

    // Assert
    assert.strictEqual(deleteMock.mock.callCount(), 1);
    assert.strictEqual(deleteMock.mock.calls[0].arguments[0], 'ALL');
  });

  it('should set keys in watchedTests when specific tests are requested to be watched', () => {
    // Arrange
    const profile: ITestRunProfile = {};
    const request: ITestRunRequest = {
      include: [item],
      exclude: undefined,
      continuous: true,
      profile,
    };
    const cancellation: ICancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested,
    };

    // Act
    set.mock.resetCalls();
    watchedTests.set = set;
    handleRunRequest(controller, request, cancellation, getConfig, watchedTests);

    // Assert
    assert.strictEqual(set.mock.callCount(), 1);
    assert.strictEqual(set.mock.calls[0].arguments[0], item);
    assert.strictEqual(set.mock.calls[0].arguments[1], profile);
  });
});

describe('placeTestsInQueue', () => {
  it.skip('test', async () => {
    // Arrange
    const items: Iterable<ITestItem> = [];
    let request: ITestRunRequest = {
      include: undefined,
      exclude: undefined,
      profile: undefined,
    };

    // Act
    placeTestsInQueue(items, request, testRun);

    // Assert
  });
  it('places a single item in the queue', async () => {
    // Arrange
    const items: Iterable<ITestItem> = [tcItem1];
    let request: ITestRunRequest = {
      include: [tcItem1],
      exclude: undefined,
      profile: undefined,
    };

    // Act
    const result = placeTestsInQueue(items, request, testRun);

    // Assert
    assert.deepStrictEqual(result, [tcItem1]);
  });
  it('places all children of an item in the queue', async () => {
    // Arrange
    const items: Iterable<ITestItem> = [fItem1, tcItem1, tcItem2, tcItem3];
    let request: ITestRunRequest = {
      include: [fItem1],
      exclude: undefined,
      profile: undefined,
    };

    // Act
    const result = placeTestsInQueue(items, request, testRun);

    // Assert
    assert.deepStrictEqual(result, [tcItem1, tcItem2]);
  });
  it('places all children of an item in the queue, except an excluded one', async () => {
    // Arrange
    const items: Iterable<ITestItem> = [fItem1, tcItem1, tcItem2, tcItem3];
    let request: ITestRunRequest = {
      include: [fItem1],
      exclude: [tcItem1],
      profile: undefined,
    };

    // Act
    const result = placeTestsInQueue(items, request, testRun);

    // Assert
    assert.deepStrictEqual(result, [tcItem2]);
  });
  it('places no children of an item in the queue, as all are excluded', async () => {
    // Arrange
    const items: Iterable<ITestItem> = [fItem1, tcItem1, tcItem2, tcItem3];
    let request: ITestRunRequest = {
      include: [fItem1],
      exclude: [tcItem1, tcItem2],
      profile: undefined,
    };

    // Act
    const result = placeTestsInQueue(items, request, testRun);

    // Assert
    assert.deepStrictEqual(result, []);
  });
});
