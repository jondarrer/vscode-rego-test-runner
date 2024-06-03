import path from 'node:path';

import { minimatch } from 'minimatch';

import { placeTestsInQueue, runTestQueue } from './queue-tests';
import { regoTestFileParser } from './rego-test-file-parser';
import {
  IFindFilesFunc,
  ICancellationToken,
  ITestController,
  ITestItem,
  ITestRunRequest,
  ITextDocument,
  IUri,
  ITestItemCollection,
  IOnTestHanderFunc,
  IRange,
  IReadFileFunc,
  IGetConfigFunc,
  ITestRunProfile,
  IEventEmitter,
  ICreateFileSystemWatcherFunc,
  IFileSystemWatcher,
} from './types';
import { Newable } from './vscode-classes';

const textDecoder = new TextDecoder('utf-8');

export const handleRunRequest = (
  controller: ITestController,
  request: ITestRunRequest,
  cancellation: ICancellationToken,
  getConfig: IGetConfigFunc,
  watchedTests: Map<ITestItem | 'ALL', ITestRunProfile | undefined>,
) => {
  // If the request is a regular, ad-hoc request to run tests immediately,
  // then start a new test run.
  if (!request.continuous) {
    const { cwd, policyTestDir, opaCommand } = getConfig();
    startTestRun(controller, request, cwd, policyTestDir, opaCommand);
  } else {
    // When dealing with a request to continouly run tests as files change,
    // we add these files to those which we're watching. Then, when a file
    // changes, we can check to see whether we need to run a test for this file
    // or not.
    // A special case is the ALL case, which is where we have a continous test,
    // but no tests included.
    if (request.include === undefined) {
      watchedTests.set('ALL', request.profile);
      cancellation.onCancellationRequested(() => watchedTests.delete('ALL'));
    } else {
      request.include.forEach((item) => watchedTests.set(item, request.profile));
      cancellation.onCancellationRequested(() => request.include!.forEach((item) => watchedTests.delete(item)));
    }
  }
};

export const updateWorkspaceTestFile = (
  controller: ITestController,
  document: ITextDocument,
  testFilePatterns: string[],
): ITestItem | undefined => {
  if (document.uri.scheme !== 'file') {
    return;
  }

  if (!testFilePatterns.some((testFilePattern) => minimatch(document.uri.fsPath, testFilePattern))) {
    return;
  }

  return registerTestItemFile(controller, document.uri);
};

export const registerTestItemFile = (controller: ITestController, uri: IUri): ITestItem => {
  const existing = controller.items.get(uri.fsPath);
  if (existing) {
    return existing;
  }

  const item = controller.createTestItem(uri.fsPath, uri.fsPath.split(path.sep).pop()!, uri);
  controller.items.add(item);
  return item;
};

export const registerTestItemCasesFromFile = (
  controller: ITestController,
  item: ITestItem,
  content: string,
): ITestItemCollection => {
  const children: ITestItem[] = [];

  const onTestHandler: IOnTestHanderFunc = (packageName: string | null, testName: string, range: IRange): void => {
    // You can query the value of any rule loaded into OPA by referring to it
    // with an absolute path. The path of a rule is always:
    // data.<package-path>.<rule-name>.
    // https://www.openpolicyagent.org/docs/latest/#rego
    const id = `data.${packageName !== null ? packageName + '.' : ''}${testName}`;
    const testCase = controller.createTestItem(id, testName, item.uri);
    testCase.range = range;
    children.push(testCase);
  };

  regoTestFileParser(content, onTestHandler);

  item.children.replace(children);

  return item.children;
};

export const refreshTestFiles = async (
  controller: ITestController,
  pattern: string,
  findFiles: IFindFilesFunc,
  readFile: IReadFileFunc,
): Promise<ITestItem[]> => {
  return Promise.all((await findFiles(pattern)).map(async (uri) => refreshTestFile(controller, uri, readFile)));
};

export const refreshTestFile = async (
  controller: ITestController,
  uri: IUri,
  readFile: IReadFileFunc,
): Promise<ITestItem> => {
  const item = registerTestItemFile(controller, uri);

  const rawContent = await readFile(uri);
  const content = textDecoder.decode(rawContent);
  registerTestItemCasesFromFile(controller, item, content);

  return item;
};

export const startTestRun = async (
  controller: ITestController,
  request: ITestRunRequest,
  cwd: string | undefined,
  policyTestDir: string,
  opaCommand: string = 'opa',
) => {
  const testRun = controller.createTestRun(request);
  const items: ITestItem[] = [];

  controller.items.forEach((item) => {
    item.children.forEach((child) => items.push(child));
    items.push(item);
  });

  const queue = placeTestsInQueue(items, request, testRun);
  await runTestQueue(testRun, queue, cwd, policyTestDir, opaCommand);
};

export const handleFileChanged = (
  controller: ITestController,
  TestRunRequest: Newable<ITestRunRequest>,
  uri: IUri,
  watchedTests: Map<ITestItem | 'ALL', ITestRunProfile | undefined>,
  cwd: string | undefined,
  policyTestDir: string,
  opaCommand?: string,
): void => {
  if (watchedTests.has('ALL')) {
    startTestRun(
      controller,
      new TestRunRequest(undefined, undefined, watchedTests.get('ALL'), true),
      cwd,
      policyTestDir,
      opaCommand,
    );
    return;
  }

  const include: ITestItem[] = [];
  let profile: ITestRunProfile | undefined;
  for (const [item, thisProfile] of watchedTests) {
    const cast = item as ITestItem;
    if (cast.uri?.toString() === uri.toString()) {
      include.push(cast);
      profile = thisProfile;
    }
  }

  if (include.length) {
    startTestRun(controller, new TestRunRequest(include, undefined, profile, true), cwd, policyTestDir, opaCommand);
  }
};

export const setupFileSystemWatchers = (
  controller: ITestController,
  fileChangedEmitter: IEventEmitter<IUri>,
  createFileSystemWatcher: ICreateFileSystemWatcherFunc,
  readFile: IReadFileFunc,
  getConfig: IGetConfigFunc,
): IFileSystemWatcher[] => {
  const { testFilePatterns } = getConfig();
  return testFilePatterns.map((testFilePattern) => {
    const watcher = createFileSystemWatcher(testFilePattern);

    watcher.onDidCreate((uri) => {
      registerTestItemFile(controller, uri);
      fileChangedEmitter.fire(uri);
    });
    watcher.onDidChange(async (uri) => {
      await refreshTestFile(controller, uri, readFile);
      fileChangedEmitter.fire(uri);
    });
    watcher.onDidDelete((uri) => controller.items.delete(uri.toString()));

    return watcher;
  });
};
