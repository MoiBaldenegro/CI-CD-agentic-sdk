import { DomainValidationError } from "../../exceptions/DomainValidationError.js";
import { ValueObject } from "../ValueObject.js";

const MAX_EXTERNAL_ID_LENGTH = 200;
const MAX_URL_LENGTH = 2_048;

interface TaskSourceRefProps extends Record<string, unknown> {
  readonly externalId: string;
  readonly url: string | null;
}

export class TaskSourceRef extends ValueObject<TaskSourceRefProps> {
  private constructor(externalId: string, url: string | null) {
    super({ externalId, url });
  }

  static from(externalId: string, url: string | null = null): TaskSourceRef {
    const normalizedId = externalId.trim();

    if (normalizedId.length === 0) {
      throw new DomainValidationError(
        "TASK_SOURCE_REF_EMPTY_ID",
        "Task source reference id must not be empty",
      );
    }

    if (normalizedId.length > MAX_EXTERNAL_ID_LENGTH) {
      throw new DomainValidationError(
        "TASK_SOURCE_REF_ID_TOO_LONG",
        `Task source reference id must be at most ${MAX_EXTERNAL_ID_LENGTH} characters`,
      );
    }

    return new TaskSourceRef(normalizedId, normalizeUrl(url));
  }

  get externalId(): string {
    return this.props.externalId;
  }

  get url(): string | null {
    return this.props.url;
  }

  override toString(): string {
    return this.props.externalId;
  }
}

function normalizeUrl(url: string | null): string | null {
  if (url === null) return null;

  const normalized = url.trim();

  if (normalized.length === 0) {
    throw new DomainValidationError("TASK_SOURCE_REF_EMPTY_URL", "Source url must not be empty");
  }

  if (normalized.length > MAX_URL_LENGTH) {
    throw new DomainValidationError(
      "TASK_SOURCE_REF_URL_TOO_LONG",
      `Source url must be at most ${MAX_URL_LENGTH} characters`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new DomainValidationError(
      "TASK_SOURCE_REF_INVALID_URL",
      "Source url must be a valid absolute url",
      { url },
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new DomainValidationError(
      "TASK_SOURCE_REF_UNSUPPORTED_PROTOCOL",
      "Source url must use http or https",
      { protocol: parsed.protocol },
    );
  }

  return parsed.toString();
}
