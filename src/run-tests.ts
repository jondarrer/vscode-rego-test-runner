import path from 'path';

import { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio, spawn } from 'node:child_process';
import os from 'node:os';

import { IOpaTestResult, ITestItem, ITestMessage, ITestRun, IUri } from './types';
import { TestMessage } from './test-classes';

export const executeTests = (
  cwd: string | undefined,
  policyTestDir: string,
  opaCommand: string = 'opa',
  scenarioName: string | undefined
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

  if (scenarioName) {
    opaCmdArguments.push('--run');
    opaCmdArguments.push(scenarioName);
  }
  opaCmdArguments.push('--format=json');
  console.log([cwd, opaCommand, ...opaCmdArguments]);

  return spawn(opaCommand, opaCmdArguments, opaProcessOptions);
};

export const convertResults = (testRun: ITestRun, results: string): IOpaTestResult[] | undefined => {
  try {
    return JSON.parse(results);
  } catch (error) {
    testRun.appendOutput(results);
    testRun.appendOutput((error as Error).message);
    return undefined;
  }
};

export const extractResult = (
  cwd: string | undefined,
  results: IOpaTestResult[] | undefined,
  scenarioName: string | undefined,
  uri?: IUri
): IOpaTestResult | undefined => {
  return results?.find(
    (result) => result.name === scenarioName && `${cwd}${path.sep}${result.location.file}` === uri?.fsPath
  );
};

export const runTests = async (
  item: ITestItem,
  testRun: ITestRun,
  cwd: string | undefined,
  policyTestDir: string,
  opaCommand: string = 'opa'
): Promise<IOpaTestResult | undefined> => {
  const start = new Date();
  const scenarioName = item.label;
  let opaTestProcess: ChildProcessWithoutNullStreams;

  return new Promise((resolve, reject) => {
    try {
      const opaTestOutput: string[] = [];
      const opaErrorOutput: string[] = [];

      opaTestProcess = executeTests(cwd, policyTestDir, opaCommand, scenarioName);

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
          cwd
        );
        resolve(actual);
      });
      opaTestProcess.unref();
    } catch (error) {
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
  cwd: string | undefined
) => {
  const messages: ITestMessage[] = [];
  const scenarioName = item.label;
  const results = convertResults(testRun, opaTestOutput.join());
  if (opaErrorOutput.length > 0) {
    messages.push(new TestMessage(opaErrorOutput.join()));
  }
  let actual: IOpaTestResult | undefined;
  if (results) {
    actual = extractResult(cwd, results, scenarioName, item.uri);
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
