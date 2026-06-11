import type OpenAI from 'openai';

// The chat completion content is typed `string | null` (null when the model returns a
// tool call or refusal). Every JSON-schema call in this project expects text, so this
// pulls the content out and fails loudly rather than feeding `null` into JSON.parse.
export function getMessageContent(completion: OpenAI.Chat.Completions.ChatCompletion): string {
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty content');
  return content;
}
