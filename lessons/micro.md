---
name: Thai Micro Lesson
description: Short Thai vocab lesson optimized for listening while driving or walking — intro, new word, meaning, example, usage note, review word, recap.
---
# Thai Micro Lesson Generation Skill

## Purpose

Generate a short Thai vocabulary audio lesson for personal daily practice.
The lesson is for listening while driving, walking, or doing something else. It must be
short, clear, natural, and useful.

## Inputs

NEW words to introduce today:
{{NEW_WORDS}}

REVIEW words due for spaced repetition:
{{REVIEW_WORDS}}

- user_level: beginner / lower-intermediate
- target_duration: 45-90 seconds

## Lesson Structure

1. Short intro
2. New word in Thai
3. English meaning
4. Simple example sentence in Thai
5. English translation
6. Short usage note
7. Review word from previous lessons (used naturally)
8. Mini recap (each word = meaning)

## Style Rules

- Keep the lesson short.
- Use natural spoken Thai.
- Avoid long grammar explanations.
- Avoid textbook-style sentences.
- Prefer practical daily-life examples.
- Repeat important Thai words naturally.
- Do not overload the lesson with too many words.
- Use only beginner-friendly vocabulary unless instructed otherwise.
- Keep English explanations concise.

## Spaced Repetition Rules

- Prioritize review words that are due today.
- Use review words naturally inside examples when possible.
- Do not repeat the same word too many times in one lesson.
- New words should be introduced clearly.
- Review words should feel like reinforcement, not a separate quiz.

## Vocabulary Constraint

- Use ONLY the Thai words listed in Inputs as the vocabulary being taught. Common
  connector words are fine, but do not introduce other new vocabulary to learn.
- If a Thai sentence may sound unnatural, rewrite it. Prefer clarity over completeness.
- The script must read well for text-to-speech.

## Example (style reference only — output format is defined below)

Today we'll learn one useful Thai word: กิน. กิน means "to eat."
Example: ผมกินข้าว — "I eat rice." Review word: ตลาด means "market."
ผมกินข้าวที่ตลาด — "I eat at the market." Recap: กิน = eat, ตลาด = market.
