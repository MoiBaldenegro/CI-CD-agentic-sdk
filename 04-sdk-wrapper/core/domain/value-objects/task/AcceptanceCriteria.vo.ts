import { DomainValidationError } from "../exceptions/DomainValidationError.js";
import { ValueObject } from "../ValueObject.js";

const MAX_ITEMS = 50;
const MAX_ITEM_LENGTH = 500;

interface AcceptanceCriteriaProps extends Record<string, unknown> {
  readonly items: readonly string[];
}

export class AcceptanceCriteria extends ValueObject<AcceptanceCriteriaProps> {
  private constructor(items: readonly string[]) {
    super({ items: Object.freeze([...items]) });
  }

  static empty(): AcceptanceCriteria {
    return new AcceptanceCriteria([]);
  }

  static from(items: readonly string[]): AcceptanceCriteria {
    if (items.length > MAX_ITEMS) {
      throw new DomainValidationError(
        "ACCEPTANCE_CRITERIA_TOO_MANY",
        `Acceptance criteria must have at most ${MAX_ITEMS} items`,
        { count: items.length },
      );
    }

    const normalized: string[] = [];

    for (const item of items) {
      const value = item.trim();

      if (value.length === 0) {
        throw new DomainValidationError(
          "ACCEPTANCE_CRITERIA_EMPTY_ITEM",
          "Acceptance criteria items must not be empty",
        );
      }

      if (value.length > MAX_ITEM_LENGTH) {
        throw new DomainValidationError(
          "ACCEPTANCE_CRITERIA_ITEM_TOO_LONG",
          `Acceptance criteria items must be at most ${MAX_ITEM_LENGTH} characters`,
          { length: value.length },
        );
      }

      normalized.push(value);
    }

    return new AcceptanceCriteria([...new Set(normalized)]);
  }

  get items(): readonly string[] {
    return this.props.items;
  }

  get count(): number {
    return this.props.items.length;
  }

  isEmpty(): boolean {
    return this.props.items.length === 0;
  }

  with(item: string): AcceptanceCriteria {
    return AcceptanceCriteria.from([...this.props.items, item]);
  }
}
