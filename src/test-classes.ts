// Concrete classes from interfaces to facilitate testing
import { IMarkdownString, IPosition, IRange, ITestMessage } from './types';

export class Range implements IRange {
  constructor(
    public start: IPosition,
    public end: IPosition,
  ) {}
}

export class Position implements IPosition {
  constructor(
    public line: number,
    public character: number,
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
