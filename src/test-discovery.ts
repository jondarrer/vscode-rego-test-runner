import path from 'node:path';

import { minimatch } from 'minimatch';

import { regoTestFileParser } from './rego-test-file-parser';
import {
  IFindFilesFunc,
  ITestController,
  ITestItem,
  ITextDocument,
  IUri,
  ITestItemCollection,
  IOnTestHanderFunc,
  IRange,
  IReadFileFunc,
  IGetConfigFunc,
  IEventEmitter,
  ICreateFileSystemWatcherFunc,
  IFileSystemWatcher,
  INote,
} from './types';

const textDecoder = new TextDecoder('utf-8');

export const updateWorkspaceTestFile = (
  controller: ITestController,
  document: ITextDocument,
  testFilePatterns: string[],
  policyTestPath: string,
): ITestItem | undefined => {
  if (document.uri.scheme !== 'file') {
    return;
  }

  if (!testFilePatterns.some((testFilePattern) => minimatch(document.uri.fsPath, testFilePattern))) {
    return;
  }

  return registerTestItemFile(controller, policyTestPath, document.uri);
};

export const createTestItemFile = (controller: ITestController, uri: IUri): ITestItem => {
  const existing = getItem(controller.items, uri);

  if (existing) {
    return existing;
  }

  const item = controller.createTestItem(uri.fsPath, uri.fsPath.split(path.sep).pop()!, uri);

  return item;
};

export const registerTestItemFile = (controller: ITestController, policyTestPath: string, uri: IUri): ITestItem => {
  const item = createTestItemFile(controller, uri);
  const parent = getParentItem(controller, policyTestPath, uri);

  parent?.children.add(item);

  return item;
};

/**
 *
 * @param controller
 * @param item The file in which the test cases reside
 * @param content
 * @returns All the test cases discovered
 */
export const registerTestItemCasesFromFile = (
  controller: ITestController,
  item: ITestItem,
  content: string,
  notes: INote[],
): ITestItemCollection => {
  const children: ITestItem[] = [];
  const testIds = new Set<string>();

  const onTestHandler: IOnTestHanderFunc = (packageName: string | null, testName: string, range: IRange): void => {
    // You can query the value of any rule loaded into OPA by referring to it
    // with an absolute path. The path of a rule is always:
    // data.<package-path>.<rule-name>.
    // https://www.openpolicyagent.org/docs/latest/#rego
    const id = `data.${packageName !== null ? packageName + '.' : ''}${testName}`;
    const testCase = controller.createTestItem(id, testName, item.uri);
    testCase.range = range;
    if (testIds.has(id)) {
      notes.push({
        type: 'duplicate',
        message: `Rename duplicate test to ensure accurate test results. ${id} found multiple times in file ${item.uri?.fsPath}`,
      });
    } else {
      testIds.add(id);
      children.push(testCase);
    }
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
  notes: INote[],
  policyTestPath: string,
): Promise<ITestItem[]> => {
  return Promise.all(
    (await findFiles(pattern)).map(async (uri) => refreshTestFile(controller, uri, readFile, notes, policyTestPath)),
  );
};

export const refreshTestFile = async (
  controller: ITestController,
  uri: IUri,
  readFile: IReadFileFunc,
  notes: INote[],
  policyTestPath: string,
): Promise<ITestItem> => {
  const item = registerTestItemFile(controller, policyTestPath, uri);
  const rawContent = await readFile(uri);
  const content = textDecoder.decode(rawContent);

  registerTestItemCasesFromFile(controller, item, content, notes);

  return item;
};

export const setupFileSystemWatchers = (
  controller: ITestController,
  fileChangedEmitter: IEventEmitter<IUri>,
  createFileSystemWatcher: ICreateFileSystemWatcherFunc,
  readFile: IReadFileFunc,
  getConfig: IGetConfigFunc,
  notes: INote[],
): IFileSystemWatcher[] => {
  const { testFilePatterns, policyTestPath } = getConfig();
  return testFilePatterns.map((testFilePattern) => {
    const watcher = createFileSystemWatcher(testFilePattern);

    watcher.onDidCreate((uri) => {
      registerTestItemFile(controller, policyTestPath, uri);
      fileChangedEmitter.fire(uri);
    });
    watcher.onDidChange(async (uri) => {
      await refreshTestFile(controller, uri, readFile, notes, policyTestPath);
      fileChangedEmitter.fire(uri);
    });
    watcher.onDidDelete((uri) => controller.items.delete(uri.toString()));

    return watcher;
  });
};

export const getRelativePath = (dir: string, uri: IUri): string => {
  return path.relative(dir, uri.fsPath);
};

export const getItem = (children: ITestItemCollection, uri: IUri): ITestItem | undefined => {
  const item = children.get(uri.fsPath);
  if (item) {
    return item;
  } else {
    for (let [_id, child] of children) {
      const other = getItem(child.children, uri);
      if (other) {
        return other;
      }
    }
  }
};

export const getParentItem = (controller: ITestController, dir: string, uri: IUri): ITestItem | undefined => {
  const relativePath = getRelativePath(dir, uri);
  const pathParts = relativePath.split(path.sep);

  if (pathParts.length > 0) {
    // if pathParts is ['path', 'to', 'file.rego'], we want a new uri of ${dir}/path/to with label to
    pathParts.pop();
    const newPath = path.join(dir, pathParts.join(path.sep));
    const newUri = uri.with({ path: newPath });
    const item = createTestItemFile(controller, newUri);
    let parent: ITestItem | undefined = undefined;
    if (pathParts.length > 0) {
      parent = getParentItem(controller, dir, newUri);
    }

    if (parent) {
      parent.children.add(item);
      // The parent property is automatically set for the child when it is added to the list of children
      // item.parent = parent;
    } else {
      controller.items.add(item);
    }

    return item;
  }
};
