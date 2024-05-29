import { Position, Range } from './test-classes';
import { IOnTestHanderFunc, IRange } from './types';

const TEST_BLOCK_REGEX = /^(test_\w*)/;
const PACKAGE_NAME_REGEX = /^package\s(\S*)/;

export const regoTestFileParser = (content: string, onTestHandler: IOnTestHanderFunc): void => {
  let packageName: string | null = null;
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!packageName && PACKAGE_NAME_REGEX.test(line)) {
      const matches = PACKAGE_NAME_REGEX.exec(line);
      packageName = matches && matches[1];
    } else {
      const matches = TEST_BLOCK_REGEX.exec(line);

      if (matches) {
        const testName = matches[0];
        const range: IRange = new Range(new Position(i, 0), new Position(i, testName.length));
        onTestHandler(packageName, testName, range);
      }
    }
  }
};
