import { runTests } from './run-tests';
import { ITestItem, ITestRun, ITestRunRequest } from './types';

export const runTestQueue = async (testRun: ITestRun, queue: Iterable<ITestItem>, cwd: string | undefined) => {
  for (const item of queue) {
    testRun.appendOutput(`Running ${item.id}\r\n`);
    if (testRun.token.isCancellationRequested) {
      testRun.skipped(item);
    } else {
      testRun.started(item);
      await runTests(item, testRun, cwd);
    }
    testRun.appendOutput(`Completed ${item.id}\r\n`);
  }

  testRun.end();
};

export const placeTestsInQueue = (
  items: Iterable<ITestItem>,
  request: ITestRunRequest,
  testRun: ITestRun,
  queue: ITestItem[] = []
): ITestItem[] => {
  for (const item of items) {
    // Is this item, or its parent NOT in any include list
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
    if (!item.uri?.path.endsWith(item.label)) {
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
