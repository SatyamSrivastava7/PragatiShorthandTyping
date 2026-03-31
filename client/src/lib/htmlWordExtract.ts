import DOMPurify from 'dompurify';

// Extracts words from HTML with formatting and paragraph break positions
// Returns: {
//   plainText: "word1 word2 word3" (no PARA_TOKEN - just words for alignment),
//   formattedWords: ["<b>word1</b>", "word2", ...],
//   paragraphBreaks: [2, 5] (indices in formattedWords array where paragraph breaks occur)
// }
export function extractFormattedWords(html: string): {
  plainText: string;
  formattedWords: string[];
  paragraphBreaks: number[];
} {
  if (!html || typeof html !== 'string') {
    return { plainText: '', formattedWords: [], paragraphBreaks: [] };
  }

  try {
    const sanitized = DOMPurify.sanitize(html);
    const fragment = document.createElement('div');
    fragment.innerHTML = sanitized;

    const formattedWords: string[] = [];
    const plainWords: string[] = [];
    const paragraphBreaks: number[] = [];

    // Walk through the DOM and extract each word with its formatting, tracking paragraph breaks
    const walk = (node: Node, openTags: string[] = [], closeTags: string[] = []) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const words = text.split(/\s+/).filter(w => w);
        
        for (const word of words) {
          // Build formatted word with current open/close tags
          const formattedWord = openTags.join('') + DOMPurify.sanitize(word) + closeTags.join('');
          formattedWords.push(formattedWord);
          plainWords.push(word);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();
        
        // Track paragraph breaks
        if (tagName === 'br' || tagName === 'p' || tagName === 'div') {
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i], openTags, closeTags);
          }
          // Record paragraph break at current word position
          // Only add if there are words before it and we haven't already marked this position
          if (formattedWords.length > 0 && !paragraphBreaks.includes(formattedWords.length)) {
            paragraphBreaks.push(formattedWords.length);
          }
          return;
        }
        
        // Preserve formatting tags
        const formattingTags = ['b', 'strong', 'i', 'em', 'u', 'mark', 'code', 'span'];
        
        if (formattingTags.includes(tagName)) {
          // Build the opening tag with all attributes (style, class, etc.)
          let openTag = `<${tagName}`;
          
          // Preserve all attributes from the element
          const attrs = element.attributes;
          for (let i = 0; i < attrs.length; i++) {
            const attr = attrs[i];
            const attrValue = DOMPurify.sanitize(attr.value);
            openTag += ` ${attr.name}="${attrValue}"`;
          }
          openTag += '>';
          
          const closeTag = `</${tagName}>`;
          
          const newOpenTags = [...openTags, openTag];
          const newCloseTags = [closeTag, ...closeTags];
          
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i], newOpenTags, newCloseTags);
          }
        } else {
          // For other tags, skip them but continue walking their children
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i], openTags, closeTags);
          }
        }
      }
    };

    walk(fragment);

    return {
      plainText: plainWords.join(' '),
      formattedWords: formattedWords,
      paragraphBreaks: paragraphBreaks,
    };
  } catch (e) {
    console.error('Error extracting formatted words:', e);
    return { plainText: DOMPurify.sanitize(html), formattedWords: [], paragraphBreaks: [] };
  }
}

// Get formatted version of a word by its plain text index
export function getFormattedWordByIndex(formattedWords: string[], index: number): string {
  if (index >= 0 && index < formattedWords.length) {
    return formattedWords[index];
  }
  return '';
}

