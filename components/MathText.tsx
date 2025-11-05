import React from 'react';

const FRACTION_UNICODE_MAP: Record<string, string> = {
  '1/2': '½',
  '1/3': '⅓',
  '2/3': '⅔',
  '1/4': '¼',
  '3/4': '¾',
  '1/5': '⅕',
  '2/5': '⅖',
  '3/5': '⅗',
  '4/5': '⅘',
  '1/6': '⅙',
  '5/6': '⅚',
  '1/8': '⅛',
  '3/8': '⅜',
  '5/8': '⅝',
  '7/8': '⅞',
};

const FRACTION_SLASH = '\u2044';

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '(': '⁽',
  ')': '⁾',
  '=': '⁼',
  'n': 'ⁿ',
};

const toSuperscript = (value: string) =>
  value
    .split('')
    .map((char) => SUPERSCRIPT_MAP[char] ?? char)
    .join('');

const KATEX_SCRIPT_SELECTOR = 'script[src*="katex"]';
const MATH_REGEX = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;

export interface MathTextProps {
  text: string;
}

const getFallbackFraction = (numerator: string, denominator: string) => {
  const normalizedNumerator = numerator.trim();
  const normalizedDenominator = denominator.trim();
  const key = `${normalizedNumerator}/${normalizedDenominator}`;
  return (
    FRACTION_UNICODE_MAP[key] ||
    `${toSuperscript(normalizedNumerator)}${FRACTION_SLASH}${toSuperscript(normalizedDenominator)}`
  );
};

const sanitizeLatexText = (text: string) => {
  if (!text) {
    return '';
  }

  const convertFractions = text.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, num, den) =>
    getFallbackFraction(num, den)
  );

  return convertFractions
    .replace(/\\Box/g, '□')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\left|\\right/g, '')
    .replace(/\\ /g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const withPreservedWhitespace = (original: string, sanitized: string) => {
  if (!sanitized) {
    return original;
  }

  const leadingSpaces = original.match(/^\s*/)?.[0] ?? '';
  const trailingSpaces = original.match(/\s*$/)?.[0] ?? '';
  return `${leadingSpaces}${sanitized}${trailingSpaces}`;
};

const renderPlainText = (part: string, index: number, katex: any) => {
  if (!part) {
    return null;
  }

  if (!part.includes('\\')) {
    return <span key={index}>{part}</span>;
  }

  if (!part.includes('\\Box')) {
    const sanitized = sanitizeLatexText(part);
    return <span key={index}>{withPreservedWhitespace(part, sanitized)}</span>;
  }

  const segments = part.split(/(\\Box)/g);

  return (
    <React.Fragment key={index}>
      {segments.map((segment, segmentIndex) => {
        if (segment === '\\Box') {
          if (!katex) {
            return <span key={`${index}-box-${segmentIndex}`}>□</span>;
          }

          try {
            const html = katex.renderToString('\\Box', {
              displayMode: false,
              throwOnError: false,
            });

            return (
              <span
                key={`${index}-box-${segmentIndex}`}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (error) {
            console.error('Failed to render box symbol:', error);
            return <span key={`${index}-box-${segmentIndex}`}>□</span>;
          }
        }

        if (!segment) {
          return null;
        }

        const content = segment.includes('\\')
          ? withPreservedWhitespace(segment, sanitizeLatexText(segment))
          : segment;
        return <span key={`${index}-${segmentIndex}`}>{content}</span>;
      })}
    </React.Fragment>
  );
};

const renderMath = (part: string, index: number, katex: any) => {
  if (!part) return null;

  const isBlock = part.startsWith('$$') && part.endsWith('$$');
  const isInline = part.startsWith('$') && part.endsWith('$');

  if (!isBlock && !isInline) {
    return renderPlainText(part, index, katex);
  }

  const latex = part.substring(isBlock ? 2 : 1, part.length - (isBlock ? 2 : 1));

  if (!katex) {
    const fallback = sanitizeLatexText(latex);
    return (
      <span key={index}>
        {fallback || latex.replace(/\\/g, '\\')}
      </span>
    );
  }

  try {
    const html = katex.renderToString(latex, {
      displayMode: isBlock,
      throwOnError: false,
    });
    return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch (error) {
    console.error('Failed to render math text:', error);
    return renderPlainText(part, index, katex);
  }
};

export const MathText: React.FC<MathTextProps> = ({ text }) => {
  const [katexReady, setKatexReady] = React.useState(() => {
    return typeof window !== 'undefined' && Boolean((window as any).katex);
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkKatex = () => {
      if ((window as any).katex) {
        setKatexReady(true);
        return true;
      }
      return false;
    };

    if (checkKatex()) {
      return;
    }

    const script = document.querySelector<HTMLScriptElement>(KATEX_SCRIPT_SELECTOR);
    const handleLoad = () => {
      checkKatex();
    };

    let intervalId: number | undefined;

    if (script) {
      script.addEventListener('load', handleLoad);
    }

    intervalId = window.setInterval(() => {
      if (checkKatex() && intervalId) {
        window.clearInterval(intervalId);
        intervalId = undefined;
        if (script) {
          script.removeEventListener('load', handleLoad);
        }
      }
    }, 100);

    return () => {
      if (script) {
        script.removeEventListener('load', handleLoad);
      }
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  if (typeof text !== 'string') {
    return null;
  }

  const parts = text.split(MATH_REGEX);
  const katex = katexReady ? (window as any).katex : null;

  return <>{parts.map((part, index) => renderMath(part, index, katex))}</>;
};

export default MathText;
