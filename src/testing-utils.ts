import fs from 'node:fs';
import { join } from 'node:path';

export const getTestingData = (testPolicyGroup: string): string => {
  // Because this is run from the "out" folder, we need to navigate back to the "src" folder
  return fs.readFileSync(join(__dirname, '..', 'src', `testing-data/${testPolicyGroup}-output.txt`), {
    encoding: 'utf-8',
  });
};

export const getExpectedResult = (testPolicyGroup: string): any => {
  // Because this is run from the "out" folder, we need to navigate back to the "src" folder
  return JSON.parse(
    fs.readFileSync(join(__dirname, '..', 'src', `testing-data/${testPolicyGroup}-expected-result.json`), {
      encoding: 'utf-8',
    }),
  );
};
