export const parseMessageContent = (content: string) => {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && parsed.type) {
      return parsed;
    }
  } catch (e) {
    // Not JSON
  }
  return { type: 'message', text: content };
};
