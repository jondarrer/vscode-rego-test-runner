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
import { textOutputParser } from './text-output-parser';
import { Newable } from './vscode-classes';

export const handleRunRequest = (
  controller: ITestController,
  request: ITestRunRequest,
  cancellation: ICancellationToken,
  getConfig: IGetConfigFunc,
  watchedTests: Map<ITestItem | 'ALL', ITestRunProfile | undefined>,
  TestMessage: Newable<ITestMessage>,
) => {
  // If the request is a regular, ad-hoc request to run tests immediately,
  // then start a new test run.
  if (!request.continuous) {
    const { cwd, policyTestDir, opaCommand, showEnhancedErrors } = getConfig();
    startTestRun(controller, request, cwd, policyTestDir, TestMessage, opaCommand, showEnhancedErrors);
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
  TestMessage: Newable<ITestMessage>,
  opaCommand?: string,
): void => {
  if (watchedTests.has('ALL')) {
    startTestRun(
      controller,
      new TestRunRequest(undefined, undefined, watchedTests.get('ALL'), true),
      cwd,
      policyTestDir,
      TestMessage,
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
    startTestRun(
      controller,
      new TestRunRequest(include, undefined, profile, true),
      cwd,
      policyTestDir,
      TestMessage,
      opaCommand,
    );
  }
};

export const startTestRun = async (
  controller: ITestController,
  request: ITestRunRequest,
  cwd: string | undefined,
  policyTestDir: string,
  TestMessage: Newable<ITestMessage>,
  opaCommand: string = 'opa',
  showEnhancedErrors: boolean = true,
) => {
  const testRun = controller.createTestRun(request);
  const items: ITestItem[] = [];

  controller.items.forEach((item) => {
    item.children.forEach((child) => items.push(child));
    items.push(item);
  });

  const queue = placeTestsInQueue(items, request, testRun);
  await runTestQueue(
    testRun,
    queue,
    cwd,
    policyTestDir,
    opaCommand,
    showEnhancedErrors,
    request.include === undefined,
    TestMessage,
  );
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
  runAllAtOnce: boolean = false,
  TestMessage: Newable<ITestMessage>,
) => {
  let actual: IOpaTestResult | undefined;
  let results: Map<string, IOpaTestResult> | undefined = undefined;

  try {
    if (runAllAtOnce) {
      testRun.appendOutput(`Running all tests at once\r\n`);
      results = await runTests(undefined, testRun, cwd, policyTestDir, opaCommand, showEnhancedErrors);
      testRun.appendOutput(`Completed running all ${results !== undefined ? results.size : 0} tests\r\n`);
    }
  } catch (error) {
    testRun.appendOutput((error as Error).message);
    testRun.end();
  }

  for (const item of queue) {
    const testId = item.id;
    const messages: ITestMessage[] = [];
    if (testRun.token.isCancellationRequested) {
      testRun.skipped(item);
    } else {
      testRun.started(item);
      try {
        actual = results?.get(testId);
        if (actual === undefined) {
          testRun.appendOutput(`Running individual test ${testId}\r\n`);
          results = await runTests(item, testRun, cwd, policyTestDir, opaCommand, showEnhancedErrors);
          testRun.appendOutput(`Completed individual test ${testId}\r\n`);
          actual = results?.get(testId);
        }
        if ((actual !== undefined && actual.output?.length) || 0 > 0) {
          messages.push(
            new TestMessage(
              (actual as IOpaTestResult).output?.map((output) => output.replaceAll('\n', '')).join('\r\n'),
            ),
          );
        }
        if (actual && actual.fail === true) {
          testRun.failed(item, messages, actual.duration);
        } else if (actual && actual.skip === true) {
          testRun.skipped(item);
        } else if (actual) {
          testRun.passed(item, actual.duration);
        } else {
          testRun.failed(item, messages, 0);
        }
      } catch (error) {
        testRun.failed(item, new TestMessage((error as Error).message), 0);
      }
    }
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
  showEnhancedErrors: boolean,
): Map<string, IOpaTestResult> | undefined => {
  try {
    if (showEnhancedErrors) {
      return textOutputParser(results);
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

export const runTests = async (
  item: ITestItem | undefined,
  testRun: ITestRun,
  cwd: string | undefined,
  policyTestDir: string,
  opaCommand: string = 'opa',
  showEnhancedErrors: boolean,
): Promise<Map<string, IOpaTestResult> | undefined> => {
  const testId = item?.id;
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

      opaTestProcess.on('close', (_code: number | null, _signal: NodeJS.Signals | null) => {
        if (opaErrorOutput.length > 0) {
          opaErrorOutput.forEach((err) => testRun.appendOutput(`${err}\r\n`, undefined, item));
          // testRun.appendOutput(opaErrorOutput.join(''), undefined, item);
        }

        const results = convertResults(testRun, opaTestOutput.join(''), showEnhancedErrors);
        if (!item) {
          // testRun.appendOutput(opaTestOutput.join('').replace('\n', '\r\n'));
          opaTestOutput.forEach((msg) => testRun.appendOutput(`${msg.replaceAll('\n', '\r\n')}`));
        }
        resolve(results);
      });
      opaTestProcess.unref();
    } catch (error) {
      reject(error);
    }
  });
};
