import { IOpaTestResult, IUri } from './types';

const RESULT_REGEX = /^(.+)\.(.+): (PASS|FAIL) \((\d+\.\d+)(µs|ms|s)\)/m;
const FILE_REGEX = /^(.+\/.+):\n(.+)\n(-+)/m;
const FAILURES_REGEX = /^FAILURES\n-+\n(?:((.|\n)*))(\n\nSUMMARY)/m;

export const textOutputParser = (
  content: string,
  cwd: string | undefined,
  uri: IUri | undefined,
  testId: string,
): IOpaTestResult[] => {
  let result: IOpaTestResult;
  const matches = RESULT_REGEX.exec(content);

  if (matches) {
    const file = FILE_REGEX.exec(content);
    result = {
      location: {
        file: `${file && file.length > 1 ? file[1] : uri?.path}`,
      },
      package: matches[1],
      name: matches[2],
      duration: 0,
    };
    if (matches[3] === 'FAIL') {
      result.fail = true;
      const failure = FAILURES_REGEX.exec(content);
      result.output = failure && failure.length > 1 ? failure[1] : undefined;
    }
    let duration: any = matches[4];
    if (isNaN(duration)) {
      duration = 0;
    } else {
      duration = parseFloat(duration);
    }
    if (matches[5] === 'µs') {
      result.duration = duration / 1_000;
    } else if (matches[5] === 'ms') {
      result.duration = duration;
    } else {
      result.duration = duration * 1_000;
    }
    return [result];
  } else {
    const [name, ...rest] = testId.split('.').reverse();
    const packageName = [...rest].reverse().join('.');
    result = {
      location: {
        file: `${uri?.path.substring((cwd?.length || 0) + 1)}`,
      },
      package: packageName,
      name,
      duration: 0,
      fail: true,
      output: content,
    };
  }

  return [result];
};
