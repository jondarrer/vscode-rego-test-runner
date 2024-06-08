import path from 'node:path';
import { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio, spawn } from 'node:child_process';
import os from 'node:os';

import {
  ICancellationToken,
  IGetConfigFunc,
  IOpaTestResult,
  ITestController,
  ITestItem,
  ITestMessage,
  ITestRun,
  ITestRunProfile,
  ITestRunRequest,
  IUri,
} from './types';
import { TestMessage } from './test-classes';
import { textOutputParser } from './text-output-parser';
import { Newable } from './vscode-classes';

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
    const { cwd, policyTestDir, opaCommand, showEnhancedErrors } = getConfig();
    startTestRun(controller, request, cwd, policyTestDir, opaCommand, showEnhancedErrors);
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

export const startTestRun = async (
  controller: ITestController,
  request: ITestRunRequest,
  cwd: string | undefined,
  policyTestDir: string,
  opaCommand: string = 'opa',
  showEnhancedErrors: boolean = false,
) => {
  const testRun = controller.createTestRun(request);
  const items: ITestItem[] = [];

  controller.items.forEach((item) => {
    item.children.forEach((child) => items.push(child));
    items.push(item);
  });

  const queue = placeTestsInQueue(items, request, testRun);
  await runTestQueue(testRun, queue, cwd, policyTestDir, opaCommand, showEnhancedErrors);
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
        testRun.failed(item, new TestMessage((error as Error).message), 0);
      }
    }
    testRun.appendOutput(`Completed ${item.id}\r\n`);
  }

  testRun.end();
};

export const executeTests = (
  cwd: string | undefined,
  policyTestDir: string,
  opaCommand: string = 'opa',
  testId: string | undefined,
  format: 'json' | 'text' = 'json',
): ChildProcessWithoutNullStreams => {
  const opaCmdArguments = ['test'];
  const opaProcessOptions: SpawnOptionsWithoutStdio = {
    cwd,
    env: {
      ...process.env,
    },
  };
  if (os.platform() === 'win32') {
    opaProcessOptions.shell = 'cmd.exe';
  }

  if (path) {
    opaCmdArguments.push(policyTestDir);
  }

  if (testId) {
    opaCmdArguments.push('--run');
    opaCmdArguments.push(testId);
  }
  if (format === 'json') {
    opaCmdArguments.push('--format=json');
  } else {
    opaCmdArguments.push('--verbose');
  }

  return spawn(opaCommand, opaCmdArguments, opaProcessOptions);
};

export const convertResults = (
  testRun: ITestRun,
  results: string,
  item: ITestItem,
  cwd: string | undefined,
  showEnhancedErrors: boolean,
): Map<string, IOpaTestResult> | undefined => {
  try {
    if (showEnhancedErrors) {
      return textOutputParser(results, cwd, item.uri);
    } else {
      const json = JSON.parse(results) as [IOpaTestResult];
      const result = new Map<string, IOpaTestResult>();
      json.forEach((item) => result.set(`${item.package}.${item.name}`, item));
      return result;
    }
  } catch (error) {
    testRun.appendOutput(results);
    testRun.appendOutput((error as Error).message);
    return undefined;
  }
};

export const extractResult = (
  results: IOpaTestResult[] | undefined,
  testId: string | undefined,
): IOpaTestResult | undefined => {
  return results?.find((result) => `${result.package}.${result.name}` === testId);
};

export const runTests = async (
  item: ITestItem,
  testRun: ITestRun,
  cwd: string | undefined,
  policyTestDir: string,
  opaCommand: string = 'opa',
  showEnhancedErrors: boolean,
): Promise<IOpaTestResult | undefined> => {
  const start = new Date();
  const testId = item.id;
  let opaTestProcess: ChildProcessWithoutNullStreams;

  return new Promise((resolve, reject) => {
    try {
      const opaTestOutput: string[] = [];
      const opaErrorOutput: string[] = [];

      opaTestProcess = executeTests(
        cwd,
        policyTestDir,
        opaCommand,
        testId,
        showEnhancedErrors === true ? 'text' : 'json',
      );

      opaTestProcess.stdout.on('data', (chunk: any) => {
        opaTestOutput.push(chunk.toString());
      });

      opaTestProcess.stderr.on('data', (chunk: any) => {
        opaErrorOutput.push(chunk.toString());
      });

      opaTestProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        const end = new Date();
        if (opaErrorOutput.length > 0) {
          testRun.appendOutput(opaErrorOutput.join(), undefined, item);
        }

        const actual = processTestResult(
          opaTestOutput,
          opaErrorOutput,
          end.getTime() - start.getTime(),
          item,
          testRun,
          cwd,
          showEnhancedErrors,
        );
        resolve(actual);
      });
      opaTestProcess.unref();
    } catch (error) {
      item.error = (error as Error).message;
      reject(error);
    }
  });
};

export const processTestResult = (
  opaTestOutput: string[],
  opaErrorOutput: string[],
  duration: number,
  item: ITestItem,
  testRun: ITestRun,
  cwd: string | undefined,
  showEnhancedErrors: boolean,
) => {
  const messages: ITestMessage[] = [];
  const testId = item.id;
  const results = convertResults(testRun, opaTestOutput.join(), item, cwd, showEnhancedErrors);
  if (opaErrorOutput.length > 0) {
    messages.push(new TestMessage(opaErrorOutput.join()));
  }
  let actual: IOpaTestResult | undefined;
  if (results) {
    actual = results.has(testId) ? results.get(testId) : undefined;
  }
  if (actual && actual.output) {
    messages.push(new TestMessage(actual.output));
  }
  if (actual && actual.fail === true) {
    testRun.failed(item, messages, duration);
  } else if (actual) {
    testRun.passed(item, duration);
  } else {
    testRun.failed(item, messages, duration);
  }

  return actual;
};
