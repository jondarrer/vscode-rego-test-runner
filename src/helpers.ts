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
} from './types';

const textDecoder = new TextDecoder('utf-8');

export const handleRunRequest = (
  controller: ITestController,
  request: ITestRunRequest,
  cancellation: ICancellationToken,
  cwd: string | undefined,
  policyTestDir: string,
  opaCommand: string = 'opa'
) => {
  startTestRun(controller, request, cwd, policyTestDir, opaCommand);
};

export const updateWorkspaceTestFile = (
  controller: ITestController,
  document: ITextDocument,
  testFilePatterns: string[]
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
  content: string
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
  readFile: IReadFileFunc
): Promise<ITestItem[]> => {
  return Promise.all(
    (await findFiles(pattern)).map(async (uri) => {
      const item = registerTestItemFile(controller, uri);

      const rawContent = await readFile(uri);
      const content = textDecoder.decode(rawContent);
      const children = registerTestItemCasesFromFile(controller, item, content);

      return item;
    })
  );
};

export const startTestRun = async (
  controller: ITestController,
  request: ITestRunRequest,
  cwd: string | undefined,
  policyTestDir: string,
  opaCommand: string = 'opa'
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
