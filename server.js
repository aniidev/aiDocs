const express = require('express');
const path = require('path');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
if (!GROQ_API_KEY) console.warn('Warning: GROQ_API_KEY not set.');

app.post('/analyze', async (req, res) => {
  try {
    const { text, mode } = req.body;

    // Build prompt differently for each mode
    let prompt;
if(mode === 'answer') {
  prompt = `You are an AI that answers the following question directly. Return ONLY the answer text, no extra commentary. Return JSON like:
{
  "updatedText": "<answer text>",
  "feedback": "<optional feedback>"
}
Question: """${text}"""`;
} else if(mode === 'explain') {
  prompt = `You are an AI note-taking assistant.
Identify key concepts in the text. If a line contains a ":", treat the part before ":" as a term and the part after as its definition. Keep terms as-is and generate concise explanations if needed.
Return EXACTLY this JSON format:
{
  "highlights":[
    {"start":<start index>,"end":<end index>,"text":"<highlighted text>","explanation":"<short explanation>"}
  ]
}
Text: """${text}"""`;
} else {
  prompt = `You are a smart AI note-taking assistant.
Mode: ${mode}. Your task is to edit the text as if you are taking notes. 
Rules:
- If a line contains a ":", keep the term before ":" and provide a short definition or clarification.
- Preserve all original terms.
- Make edits concise and clear for studying.
Return JSON like:
{
  "updatedText": "<full document text with AI improvements inserted>",
  "feedback": "<short description of changes>"
}
Text: """${text}"""`;
}

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an AI assistant for note-taking.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const apiData = await response.json();
    let raw = apiData.choices?.[0]?.message?.content || '';

    // Try to parse the JSON returned by the AI
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // If parsing fails, wrap raw text into proper JSON
      if (mode === 'explain') {
        parsed = {
          highlights: [{ start: 0, end: text.length, text, explanation: raw || 'No explanation generated' }]
        };
      } else {
        parsed = {
          updatedText: raw || text,
          feedback: 'Unable to parse AI response properly'
        };
      }
    }

    // Send always as proper JSON
    res.json(parsed);
  } catch (err) {
    console.error('Server error while contacting Groq', err);
    res.status(500).json({ error: 'server error' });
  }
});


app.listen(3000, () => console.log('Server running on http://localhost:3000'));
