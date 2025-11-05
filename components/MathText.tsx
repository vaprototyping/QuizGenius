import React from 'react';

// Regex to split the string by LaTeX delimiters ($...$ or $$...$$), keeping the delimiters in the result.
const MATH_REGEX = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;

/**
 * Renders a segment of a math string. If KaTeX is available, it uses it.
 * Otherwise, it falls back to plain text.
 */
const renderMathSegment = (latex: string, key: string, isBlock: boolean) => {
  if (!latex) return null;
  const katex = (window as any).katex;
  if (katex) {
    try {
      const html = katex.renderToString(latex, {
        displayMode: isBlock,
        throwOnError: false,
      });
      return <span key={key} dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (error) {
      console.error('KaTeX rendering error:', error);
    }
  }
  // Fallback if KaTeX fails or isn't loaded
  return <span key={key}>{latex}</span>;
};


/**
 * A component that renders a string containing mixed plain text and LaTeX math.
 * It manually parses the string, uses KaTeX to render math, and has special handling for the `\Box` command.
 */
export const MathText: React.FC<{ text: string }> = ({ text }) => {
  const [isKatexLoaded, setIsKatexLoaded] = React.useState(false);

  React.useEffect(() => {
    if ((window as any).katex) {
      setIsKatexLoaded(true);
      return;
    }
    const interval = setInterval(() => {
      if ((window as any).katex) {
        setIsKatexLoaded(true);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);
  
  if (typeof text !== 'string') return null;

  const parts = text.split(MATH_REGEX);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        const isBlock = part.startsWith('$$') && part.endsWith('$$');
        const isInline = part.startsWith('$') && part.endsWith('$');

        // Plain text part
        if (!isBlock && !isInline) {
          return <span key={index}>{part}</span>;
        }

        // Math part, strip delimiters
        const latex = part.substring(isBlock ? 2 : 1, part.length - (isBlock ? 2 : 1));
        
        // Check for the custom \Box command
        if (latex.includes('\\Box')) {
            const segments = latex.split(/(\\Box)/g);
            return (
                <span key={index}>
                    {segments.map((segment, segIndex) => {
                        if (segment === '\\Box') {
                            return <span key={`${index}-${segIndex}`} className="mx-1">□</span>;
                        }
                        return renderMathSegment(segment, `${index}-${segIndex}`, isBlock);
                    })}
                </span>
            );
        }

        // Standard math part without \Box
        return renderMathSegment(latex, String(index), isBlock);
      })}
    </>
  );
};

export default MathText;
