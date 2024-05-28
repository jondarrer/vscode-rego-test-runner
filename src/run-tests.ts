import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { IOpaTestResult, ITestItem, ITestMessage, ITestRun, IUri } from './types';
import { TestMessage } from './test-classes';

export const executeTests = (
  cwd: string | undefined,
  path: string | undefined = '.',
  scenarioName: string | undefined
): ChildProcessWithoutNullStreams => {
  const opaCmdArguments = ['test', '--format=json'];

  if (path) {
    opaCmdArguments.push(path);
  }

  if (scenarioName) {
    opaCmdArguments.push('--run');
    opaCmdArguments.push(scenarioName);
  }
  console.log(opaCmdArguments);

  return spawn('opa', opaCmdArguments, {
    cwd: cwd,
    env: {
      ...process.env,
    },
  });
};

export const convertResults = (testRun: ITestRun, results: string): IOpaTestResult[] | undefined => {
  testRun.appendOutput(`convertResults ${results}\r\n`);
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
  return results?.find((result) => result.name === scenarioName && result.location.file === uri?.path);
};

export const runTests = async (
  item: ITestItem,
  testRun: ITestRun,
  cwd: string | undefined
): Promise<IOpaTestResult | undefined> => {
  const start = new Date();
  const scenarioName = item.label;
  let opaTestProcess: ChildProcessWithoutNullStreams;
  testRun.appendOutput(`runTests ${scenarioName}\r\n`, undefined, item);

  return new Promise((resolve, reject) => {
    const opaTestOutput: string[] = [];
    const opaErrorOutput: string[] = [];
    let path = item.uri?.path;
    if (path) {
      const parts = path.split('/');
      parts.pop();
      path = parts?.join('/');
    }

    opaTestProcess = executeTests(cwd, path, scenarioName);

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
  testRun.appendOutput(`processTestResult:results ${JSON.stringify(results)}\r\n`, undefined, item);
  testRun.appendOutput(`processTestResult:scenarioName ${scenarioName}\r\n`, undefined, item);
  testRun.appendOutput(`processTestResult:cwd ${cwd}\r\n`, undefined, item);
  testRun.appendOutput(`processTestResult:item.uri?.path ${item.uri?.path}\r\n`, undefined, item);
  if (opaErrorOutput.length > 0) {
    messages.push(new TestMessage(opaErrorOutput.join()));
  }
  let actual: IOpaTestResult | undefined;
  if (results) {
    actual = extractResult(cwd, results, scenarioName, item.uri);
  }
  if (actual && actual.fail === true) {
    testRun.appendOutput(`processTestResult:fail ${JSON.stringify(actual)}\r\n`, undefined, item);
    testRun.failed(item, messages, duration);
  } else if (actual) {
    testRun.appendOutput(`processTestResult:pass ${JSON.stringify(actual)}\r\n`, undefined, item);
    testRun.passed(item, duration);
  } else {
    testRun.appendOutput(`processTestResult:fail unknown\r\n`, undefined, item);
    testRun.failed(item, messages, duration);
  }

  return actual;
};
