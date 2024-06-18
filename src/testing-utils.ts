import fs from 'node:fs';
import { join } from 'node:path';

import { ITestItem, ITestItemCollection, IUri } from './types';

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

export class TestItemCollection implements ITestItemCollection {
  constructor(public map: Map<string, ITestItem>) {}
  get(itemId: string): ITestItem | undefined {
    return this.map.get(itemId);
  }
  add(item: ITestItem): void {
    this.map.set(item.id, item);
    this.size = this.map.size;
  }
  size: number = 0;
  replace(items: readonly ITestItem[]): void {
    this.map.clear();
    for (let item of items) {
      this.map.set(item.id, item);
    }
    this.size = this.map.size;
  }
  forEach(callback: (item: ITestItem, collection: ITestItemCollection) => unknown, thisArg?: any): void {
    for (let item of this.map.values()) {
      callback(item, this);
    }
  }
  delete(itemId: string) {
    this.map.delete(itemId);
  }
  *[Symbol.iterator]() {
    yield* this.map.values();
  }
}

export class Uri implements IUri {
  public authority: string;
  public query: string;
  public fragment: string;
  public fsPath: string;

  constructor(
    public scheme: string,
    public path: string,
  ) {
    this.authority = '';
    this.query = '';
    this.fragment = '';
    this.fsPath = path;
  }
  toString() {
    return `${this.scheme}://${this.path}`;
  }
  with(change: IUri): IUri {
    return this;
  }
  toJSON(): any {
    return {
      scheme: this.scheme,
      path: this.path,
      fsPath: this.fsPath,
    };
  }
}
