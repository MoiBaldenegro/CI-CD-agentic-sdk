import { ValueObjectBase } from './Value-object';

export class Id extends ValueObjectBase<string> {
  constructor(value: string) {
    super(value, 'invalid id');
  }

  protected validate(value: string): boolean {
    return typeof value === 'string' && value.length > 12;
  }

  static generate(): Id {
    const randomId = crypto.randomUUID();
    return new Id(randomId);
  }
}
