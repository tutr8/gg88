const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /\+?[0-9][0-9\-()\s]{6,}[0-9]/g;
const TON_ADDRESS_REGEX = /EQ[A-Za-z0-9_-]{30,48}/g;

interface PiiResult {
  redacted: string;
  classifications: string[];
}

export function classifyAndRedactText(input: string): PiiResult {
  const classifications = new Set<string>();
  let output = input;

  output = output.replace(EMAIL_REGEX, (match) => {
    classifications.add("email");
    return mask(match, 3);
  });

  output = output.replace(PHONE_REGEX, (match) => {
    classifications.add("phone");
    return mask(match, 2);
  });

  output = output.replace(TON_ADDRESS_REGEX, (match) => {
    classifications.add("wallet");
    return mask(match, 4);
  });

  return { redacted: output, classifications: Array.from(classifications) };
}

function mask(value: string, visible: number) {
  if (value.length <= visible) return "*".repeat(value.length);
  const start = value.slice(0, visible);
  const end = value.slice(-visible);
  return `${start}${"*".repeat(Math.max(value.length - visible * 2, 3))}${end}`;
}

export interface ContentSanitizationResult {
  sanitized: unknown;
  classifications: string[];
}

export function processContentForPii(
  content: unknown,
): ContentSanitizationResult {
  if (typeof content === "string") {
    const result = classifyAndRedactText(content);
    return {
      sanitized: result.redacted,
      classifications: result.classifications,
    };
  }
  if (typeof content === "object" && content && "text" in (content as any)) {
    const value = String((content as any).text ?? "");
    const result = classifyAndRedactText(value);
    return {
      sanitized: { ...(content as any), text: result.redacted },
      classifications: result.classifications,
    };
  }
  return { sanitized: content, classifications: [] };
}
