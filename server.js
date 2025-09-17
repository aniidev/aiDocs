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
 if (mode === 'explain') {
  prompt = `You are an AI note-taking assistant.
Identify key concepts in the text. If a line contains a ":", treat the part before ":" as a term and the part after as its definition. Keep terms as-is and generate concise explanations if needed.
Return ONLY valid JSON between <json> and </json> tags. Do not include anything else.
<json>
{
  "highlights":[
    {"start":<start index>,"end":<end index>,"text":"<highlighted text>","explanation":"<short explanation>"}
  ]
}
</json>
Text: """${text}"""`;
} else {
  prompt = `You are a smart AI note-taking assistant.
Mode: ${mode}. Your task is to edit the text as if you are taking notes. 
Rules:
- If a line contains a ":", keep the term before ":" and provide a short definition or clarification.
- Preserve all original terms.
- Make edits concise and clear for studying.
Return ONLY valid JSON between <json> and </json> tags. Do not include anything else.
<json>
{
  "updatedText": "<full document text with AI improvements inserted>",
  "feedback": "<short description of changes>"
}
</json>
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
  // Extract the JSON inside <json> ... </json>
  const match = raw.match(/<json>([\s\S]*?)<\/json>/);
  const jsonString = match ? match[1].trim() : raw.trim();

  parsed = JSON.parse(jsonString);
} catch (err) {
  console.error("JSON parse error, raw:", raw);

  if (mode === 'explain') {
    parsed = {
      highlights: [
        { start: 0, end: text.length, text, explanation: 'Parsing failed: ' + raw }
      ]
    };
  } else {
    parsed = {
      updatedText: text,
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
