import { IOpaTestResult, IUri } from './types';

const ERROR_REGEX = /^\d+ error(s)? occurred during loading:/;
const ALL_REGEX =
  /(?<query>[^\S\r\n]{2}.*)|(?<failures>FAILURES)?(?<summary>SUMMARY)?(?<line>-+)?((?<file>(.+\/.+)):)?((?<testId>(.+)): (?<outcome>PASS|FAIL|SKIPPED)( \((?<duration>\d+\.?\d*)(?<unit>µs|ms|s)\))?)?(?<total>(PASS|FAIL|SKIPPED): ((\d+)\/(\d+)))?/gm;

export const textOutputParser = (content: string): Map<string, IOpaTestResult> => {
  let results = new Map<string, IOpaTestResult>();
  let match: RegExpExecArray | null;
  let currentFile: string = '';
  let currentResult: IOpaTestResult = {
    name: '',
    package: '',
    output: [],
    location: {
      file: '',
    },
    duration: 0,
  };

  // If we didn't get any results, see whether we received an
  // error
  if (ERROR_REGEX.test(content)) {
    throw new Error(content);
  }

  while ((match = ALL_REGEX.exec(content)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (match.index === ALL_REGEX.lastIndex) {
      ALL_REGEX.lastIndex++;
    }

    // Either:
    // - testId+outcome+duration+unit -> query -> file
    // - file -> testId+outcome+duration+unit
    const { file, testId, outcome, duration, unit, query } = match.groups || {};
    if (file) {
      currentFile = file;
    } else if (testId) {
      if (results.has(testId)) {
        currentResult = results.get(testId) as IOpaTestResult;
      } else {
        const [name, ...rest] = testId.split('.').reverse();
        const packageName = [...rest].reverse().join('.');

        currentResult = {
          name,
          package: packageName,
          output: [],
          location: {
            file: '',
          },
          duration: 0,
        };
        results.set(testId, currentResult);
        switch (outcome) {
          case 'FAIL':
            currentResult.fail = true;
            break;
          case 'SKIPPED':
            currentResult.skip = true;
            break;
        }
        if (duration) {
          switch (unit) {
            case 'µs':
              currentResult.duration = parseFloat(duration) / 1_000;
              break;
            case 'ms':
              currentResult.duration = parseFloat(duration);
              break;
            default:
              currentResult.duration = parseFloat(duration) * 1_000;
              break;
          }
        } else {
          currentResult.duration = 0;
        }
      }
      if (currentFile) {
        currentResult.location = { file: currentFile };
      }
    } else if (query && currentResult) {
      currentResult.output?.push(query);
    }
  }

  return results;
};
