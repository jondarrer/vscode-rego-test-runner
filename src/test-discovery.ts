import path from 'node:path';

import { minimatch } from 'minimatch';

import { regoTestFileParser } from './rego-test-file-parser';
import {
  IFindFilesFunc,
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
