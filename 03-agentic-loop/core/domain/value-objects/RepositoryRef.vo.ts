import { DomainValidationError } from "../../../shared/DomainValidationError.js";
import { ValueObject } from "../../../shared/ValueObject.js";

const NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const BRANCH_PATTERN = /^[A-Za-z0-9._/-]+$/;

interface RepositoryRefProps extends Record<string, unknown> {
  readonly owner: string;
  readonly name: string;
  readonly baseBranch: string;
}

export class RepositoryRef extends ValueObject<RepositoryRefProps> {
  private constructor(owner: string, name: string, baseBranch: string) {
    super({ owner, name, baseBranch });
  }

  static from(owner: string, name: string, baseBranch = "main"): RepositoryRef {
    const normalizedOwner = owner.trim();
    const normalizedName = name.trim();
    const normalizedBranch = baseBranch.trim();

    assertSlug("owner", normalizedOwner);
    assertSlug("name", normalizedName);

    if (!BRANCH_PATTERN.test(normalizedBranch) || normalizedBranch.startsWith("/") || normalizedBranch.includes("..")) {
      throw new DomainValidationError(
        "REPOSITORY_BRANCH_INVALID",
        "Repository base branch contains invalid characters",
        { baseBranch },
      );
    }

    return new RepositoryRef(normalizedOwner, normalizedName, normalizedBranch);
  }

  get owner(): string {
    return this.props.owner;
  }

  get name(): string {
    return this.props.name;
  }

  get baseBranch(): string {
    return this.props.baseBranch;
  }

  get fullName(): string {
    return `${this.props.owner}/${this.props.name}`;
  }

  override toString(): string {
    return this.fullName;
  }
}

function assertSlug(field: "owner" | "name", value: string): void {
  if (value.length === 0 || value.length > 100 || !NAME_PATTERN.test(value)) {
    throw new DomainValidationError(
      "REPOSITORY_REF_INVALID",
      `Repository ${field} is invalid`,
      { field, value },
    );
  }
}
