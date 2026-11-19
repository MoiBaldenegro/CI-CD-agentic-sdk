import { ValidationException } from '../exception/ValidationException';

export abstract class ValueObjectBase<T> {
  protected abstract validate(value: T): boolean;

  constructor(
    private primitiveValue: T,
    errorMessage: string,
  ) {
    if (!this.validate(primitiveValue))
      throw new ValidationException(errorMessage);
  }

  getValue() {
    return this.primitiveValue;
  }
}
