import { runTests } from './run-tests';
import { TestMessage } from './test-classes';
import { ITestItem, ITestRun, ITestRunRequest } from './types';

export const runTestQueue = async (
  testRun: ITestRun,
  queue: Iterable<ITestItem>,
  cwd: string | undefined,
  policyTestDir: string,
  opaCommand: string = 'opa',
  showEnhancedErrors: boolean,
) => {
  for (const item of queue) {
    testRun.appendOutput(`Running ${item.id}\r\n`);
    if (testRun.token.isCancellationRequested) {
      testRun.skipped(item);
    } else {
      testRun.started(item);
      try {
        await runTests(item, testRun, cwd, policyTestDir, opaCommand, showEnhancedErrors);
      } catch (error) {
        console.log(error);
        testRun.failed(item, new TestMessage((error as Error).message), 0);
      }
    }
    testRun.appendOutput(`Completed ${item.id}\r\n`);
  }

  testRun.end();
};

export const placeTestsInQueue = (
  items: Iterable<ITestItem>,
  request: ITestRunRequest,
  testRun: ITestRun,
  queue: ITestItem[] = [],
): ITestItem[] => {
  for (const item of items) {
    // Is this item, or its parent NOT in any include list? This is only
    // relevant if we have an include list - like we do when a specific
    // test has been requested. We have an empty include list when all
    // tests are requested to be run.
    if (request.include && !request.include.includes(item)) {
      if (!item.parent || !request.include.includes(item.parent)) {
        continue;
      }
    }

    // Is this item, or its parent in any exlude list
    if (request.exclude?.includes(item) || !item.parent || request.exclude?.includes(item?.parent)) {
      continue;
    }

    // Only deal with actual tests, not files or folders
    if (!item.uri?.fsPath.endsWith(item.label)) {
      testRun.enqueued(item);
      queue.push(item);
    }
  }

  return queue;
};

export const isIncludedIn = (list: Iterable<ITestItem>, item: ITestItem) => {
  let result = false;

  for (let x of list) {
    if (x === item) {
      result = true;
    } else {
      item.children.forEach((y) => {
        if (x === y) {
          result = true;
        }
      });
    }
  }

  return result;
};
