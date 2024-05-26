import { IOnTestHanderFunc, IPositionConstructable, IRange, IRangeConstructable } from './types';

const TEST_BLOCK_REGEX = /^(test_\w*)/;

export const regoTestFileParser = (
  content: string,
  onTestHandler: IOnTestHanderFunc,
  Range: IRangeConstructable,
  Position: IPositionConstructable
): void => {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = TEST_BLOCK_REGEX.exec(line);

    if (matches) {
      const testName = matches[0];
      const range: IRange = new Range(new Position(i, 0), new Position(i, testName.length));
      onTestHandler(testName, range);
    }
  }
};
