export interface RedactionResult<T> {
  sanitized: T;
  redactedCount: number;
  typesRedacted: string[];
}

const REDACTION_PATTERNS: Array<{
  name: string;
  placeholder: string;
  regex: RegExp;
}> = [
  // Private keys
  {
    name: "private_key",
    placeholder: "[REDACTED_PRIVATE_KEY]",
    regex:
      /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[a-zA-Z0-9+/=\r\n]+-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/gi
  },
  // Bearer tokens & Authorization headers
  {
    name: "bearer_token",
    placeholder: "Bearer [REDACTED_AUTH_TOKEN]",
    regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi
  },
  // JWT tokens
  {
    name: "jwt_token",
    placeholder: "[REDACTED_JWT_TOKEN]",
    regex: /eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*/g
  },
  // GitHub Personal Access Tokens
  {
    name: "github_token",
    placeholder: "[REDACTED_GITHUB_TOKEN]",
    regex: /(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,255}/g
  },
  // OpenAI / generic API keys (sk-...)
  {
    name: "api_key",
    placeholder: "[REDACTED_API_KEY]",
    regex: /sk-[A-Za-z0-9]{20,64}/g
  },
  // AWS Access Key ID
  {
    name: "aws_access_key",
    placeholder: "[REDACTED_AWS_KEY]",
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g
  },
  // Database connection URLs with password
  {
    name: "connection_string",
    placeholder: "$1://$2:[REDACTED_PASSWORD]@$4",
    regex: /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/([^:]+):([^@]+)@([^/\s?#]+)/gi
  },
  // Password / Secret in JSON or query-like assignments (password=xyz, "password": "xyz")
  {
    name: "password_field",
    placeholder: '$1"[REDACTED_PASSWORD]"',
    regex:
      /(["']?(?:password|secret|api_key|access_token|private_key)["']?\s*[:=]\s*)["'][^"'\r\n]+["']/gi
  }
];

const MAX_STRING_LENGTH = 100_000;

/**
 * Redacts known sensitive credential patterns from a string.
 */
export function redactString(input: string): { text: string; count: number; types: string[] } {
  if (input.length > MAX_STRING_LENGTH) {
    input = input.substring(0, MAX_STRING_LENGTH);
  }

  let text = input;
  let count = 0;
  const types = new Set<string>();

  for (const { name, placeholder, regex } of REDACTION_PATTERNS) {
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      count += matches.length;
      types.add(name);
      text = text.replace(regex, placeholder);
    }
  }

  return { text, count, types: Array.from(types) };
}

/**
 * Recursively sanitizes any JavaScript object or primitive, replacing detected secrets.
 */
export function sanitizeData<T>(data: T): RedactionResult<T> {
  let redactedCount = 0;
  const typesSet = new Set<string>();

  function traverse(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === "string") {
      const { text, count, types } = redactString(value);
      if (count > 0) {
        redactedCount += count;
        types.forEach((t) => typesSet.add(t));
      }
      return text;
    }
    if (Array.isArray(value)) {
      return value.map((item) => traverse(item));
    }
    if (typeof value === "object") {
      const sanitizedObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        sanitizedObj[key] = traverse(val);
      }
      return sanitizedObj;
    }
    return value;
  }

  const sanitized = traverse(data) as T;

  return {
    sanitized,
    redactedCount,
    typesRedacted: Array.from(typesSet)
  };
}
