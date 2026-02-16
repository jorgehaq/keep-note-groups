/**
 * Parses a string and returns an array of segments, detecting URLs.
 * This handles http/https protocols.
 */
export const parseContentWithLinks = (text: string) => {
  // Regex to match URLs starting with http:// or https://
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  return text.split(urlRegex).map((part, index) => {
    if (part.match(urlRegex)) {
      return { type: 'link', content: part, key: index };
    }
    return { type: 'text', content: part, key: index };
  });
};

/**
 * Generates a unique ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};
