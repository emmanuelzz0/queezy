// ============================================
// Claude AI Configuration (Anthropic)
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { config } from './index.js';

// ============================================
// Anthropic Client
// ============================================

export const anthropic = new Anthropic({
    apiKey: config.ANTHROPIC_API_KEY,
});

// ============================================
// Quiz Generation Prompt Template
// ============================================

export const QUIZ_SYSTEM_PROMPT = `You are a quiz question generator for a multiplayer trivia game called Queezy.
Generate engaging, fun, and accurate multiple-choice questions.

Rules:
1. Each question must have exactly 4 options (A, B, C, D)
2. Only ONE option should be correct
3. Wrong answers should be plausible but clearly incorrect
4. Questions should be appropriate for all ages
5. Vary the difficulty as requested
6. Include interesting facts when possible
7. Avoid controversial or sensitive topics
8. Make questions fun and engaging for a party game atmosphere

You must respond with ONLY valid JSON - no markdown, no code blocks, just the raw JSON array.`;

export const generateQuizPrompt = (
    category: string,
    count: number,
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
) => `Generate ${count} multiple-choice trivia questions about "${category}".

Difficulty: ${difficulty === 'mixed' ? 'Mix of easy, medium, and hard' : difficulty}

Return a JSON array with this exact structure (no markdown, no code blocks):
[
  {
    "text": "Question text here?",
    "options": {
      "A": "First option",
      "B": "Second option",
      "C": "Third option",
      "D": "Fourth option"
    },
    "correctAnswer": "B",
    "difficulty": "easy",
    "category": "${category}"
  }
]

Important:
- Return ONLY the JSON array, no other text
- Make questions engaging and fun
- Ensure correct answers are accurate
- Make wrong answers plausible but clearly wrong
- Vary question types (who, what, when, where, which)`;

export const generateCustomTopicPrompt = (
    topicName: string,
    topicDescription: string,
    count: number
) => `Generate ${count} multiple-choice trivia questions about this custom topic:

Topic: "${topicName}"
Description: "${topicDescription}"

Return a JSON array with this exact structure (no markdown, no code blocks):
[
  {
    "text": "Question text here?",
    "options": {
      "A": "First option",
      "B": "Second option", 
      "C": "Third option",
      "D": "Fourth option"
    },
    "correctAnswer": "B",
    "difficulty": "medium",
    "category": "${topicName}"
  }
]

Important:
- Return ONLY the JSON array, no other text
- Questions should be specific to the topic
- Make questions engaging and fun
- Ensure correct answers are accurate
- Mix difficulty levels`;
