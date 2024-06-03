import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { IDisposable, ITestItem, ITestRun, ITestRunRequest } from './types';
import { placeTestsInQueue } from './queue-tests';
import { TestItemCollection, Uri } from './test-classes';

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
      (listener: (e: any) => any, thisArgs?: any, disposables?: IDisposable[]): IDisposable => ({
        dispose: (): void => {},
      }),
    ),
  },
};

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

afterEach(() => {
  mock.reset();
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
    const result = placeTestsInQueue(items, request, testRun);

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
