// Concrete classes from interfaces to facilitate testing
import { IMarkdownString, IPosition, IRange, ITestItem, ITestItemCollection, ITestMessage, IUri } from './types';

export class Range implements IRange {
  constructor(
    public start: IPosition,
    public end: IPosition
  ) {}
}

export class Position implements IPosition {
  constructor(
    public line: number,
    public character: number
  ) {}
}

export class TestMessage implements ITestMessage {
  /**
   * Creates a new TestMessage instance.
   *
   * @param message — The message to show to the user.
   */
  constructor(public message: string | IMarkdownString) {}
}

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
    public path: string
  ) {
    this.authority = '';
    this.query = '';
    this.fragment = '';
    this.fsPath = '';
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
    };
  }
}
