import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { IOpaTestResult, ITestItem, ITestRun, IUri } from './types';
import { TestMessage } from './test-classes';

export const executeTests = (
  cwd: string | undefined,
  relativePath: string | undefined = '.',
  scenarioName: string | undefined
): ChildProcessWithoutNullStreams => {
  const opaCmdArguments = ['test', '--format=json'];

  if (relativePath) {
    opaCmdArguments.push(relativePath);
  }

  if (scenarioName) {
    opaCmdArguments.push('--run');
    opaCmdArguments.push(scenarioName);
  }

  return spawn('opa', opaCmdArguments, {
    cwd: cwd,
    env: {
      ...process.env,
    },
  });
};

export const convertResults = (results: string): IOpaTestResult[] | undefined => {
  try {
    return JSON.parse(results);
  } catch (error) {
    console.log(results);
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
    (result) => result.name === scenarioName && `${cwd ? cwd : ''}/${result.location.file}` === uri?.path
  );
};

export const runTests = async (
  item: ITestItem,
  testRun: ITestRun,
  cwd: string | undefined
): Promise<IOpaTestResult | undefined> => {
  const scenarioName = item.label;
  let opaTestProcess: ChildProcessWithoutNullStreams;

  return new Promise((resolve, reject) => {
    const opaTestOutput: string[] = [];

    opaTestProcess = executeTests(cwd, undefined, scenarioName);

    opaTestProcess.stdout.on('data', (chunk: any) => {
      opaTestOutput.push(chunk.toString());
    });

    opaTestProcess.stderr.on('data', (chunk: any) => {
      const x = 1;
      // this.log(testRun, chunk);
    });

    opaTestProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      const results = convertResults(opaTestOutput.join());
      let actual: IOpaTestResult | undefined;
      if (results) {
        actual = extractResult(cwd, results, scenarioName, item.uri);
      }
      if (actual && actual.fail === true) {
        testRun.failed(item, new TestMessage('Failed'), actual.duration / 1000);
        resolve(actual);
      } else if (actual) {
        testRun.passed(item, actual.duration / 1000);
        resolve(actual);
      } else {
        testRun.failed(item, new TestMessage('Unknown'));
        resolve(actual);
      }
    });
  });
};
