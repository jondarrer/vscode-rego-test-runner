import { IPosition, IRange } from './types';

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
