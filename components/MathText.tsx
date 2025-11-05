import React from 'react';

const KATEX_SCRIPT_SELECTOR = 'script[src*="katex"]';
const MATH_REGEX = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;

export interface MathTextProps {
  text: string;
}

const renderMath = (part: string, index: number) => {
  if (!part) return null;

  const katex = (window as any).katex;
  if (!katex) {
    return <span key={index}>{part}</span>;
  }

  const isBlock = part.startsWith('$$') && part.endsWith('$$');
  const isInline = part.startsWith('$') && part.endsWith('$');

  if (!isBlock && !isInline) {
    return <span key={index}>{part}</span>;
  }

  const latex = part.substring(isBlock ? 2 : 1, part.length - (isBlock ? 2 : 1));

  try {
    const html = katex.renderToString(latex, {
      displayMode: isBlock,
      throwOnError: false,
    });
    return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch (error) {
    console.error('Failed to render math text:', error);
    return <span key={index}>{part}</span>;
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

  if (!katexReady) {
    return <span>{text}</span>;
  }

  const parts = text.split(MATH_REGEX);

  return <>{parts.map((part, index) => renderMath(part, index))}</>;
};

export default MathText;
