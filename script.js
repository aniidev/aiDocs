// DOM references
const editor = document.getElementById('editor');
const analyzeBtn = document.getElementById('analyzeBtn');
const explainBtn = document.getElementById('explainBtn');
const improveBtn = document.getElementById('improveBtn');
const answerBtn = document.getElementById('answerBtn');
const statusEl = document.getElementById('status');
const feedbackEl = document.getElementById('feedback');

const explainPopup = document.getElementById('explainPopup');
const explainContent = document.getElementById('explainContent');
const closeExplain = document.getElementById('closeExplain');

// Toolbar buttons
document.getElementById('boldBtn').addEventListener('click', () => document.execCommand('bold'));
document.getElementById('italicBtn').addEventListener('click', () => document.execCommand('italic'));
document.getElementById('underlineBtn').addEventListener('click', () => document.execCommand('underline'));

// Helpers
function getDocumentText() { 
  return editor.innerText.replace(/\u00A0/g, ' ').trim(); 
}

function setEditorText(text) { 
  editor.innerText = text; 
}

function getSelectedRange() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  return sel.getRangeAt(0);
}

// Analyze / Explain / Improve / Answer
async function analyzeDocument(mode = 'full') {
  let range = null;
  let textToSend = '';

  if (mode === 'explain' || mode === 'answer' || mode === 'improve') {
    range = getSelectedRange();
    if (!range || range.toString().trim() === '') {
      feedbackEl.innerText = 'Select some text first.';
      return;
    }
    textToSend = range.toString();
  } else {
    textToSend = getDocumentText();
  }

  statusEl.textContent = 'analyzing';
  analyzeBtn.disabled = explainBtn.disabled = improveBtn.disabled = answerBtn.disabled = true;

  try {
    const res = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textToSend, mode })
    });
    if (!res.ok) throw new Error('server error');

    let data = await res.json();

    // Ensure we parse if server returned raw JSON string
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { /* keep as string */ }
    }

    if (mode === 'explain') {
      explainContent.innerHTML = '';
      (data.highlights || []).forEach(h => {
        const div = document.createElement('div');
        div.style.marginBottom = '8px';
        div.innerHTML = `<strong>${h.text}:</strong> ${h.explanation || 'No explanation.'}`;
        explainContent.appendChild(div);
      });
      explainPopup.style.display = 'block';
    } else if (range) {
  const updated = data.updatedText || textToSend;
  range.deleteContents();
  range.insertNode(document.createTextNode(updated));

  // Short feedback: just describe the edit
  feedbackEl.innerText = `AI updated selected text.`;
} else {
  setEditorText(data.updatedText || textToSend);
  feedbackEl.innerText = `AI updated the document.`;
}

    statusEl.textContent = 'ready';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'error';
    feedbackEl.innerText = 'Error contacting server.';
  } finally {
    analyzeBtn.disabled = explainBtn.disabled = improveBtn.disabled = answerBtn.disabled = false;
  }
}


// Button event listeners
analyzeBtn.addEventListener('click', () => analyzeDocument('full'));
improveBtn.addEventListener('click', () => analyzeDocument('improve'));
explainBtn.addEventListener('click', () => analyzeDocument('explain'));
answerBtn.addEventListener('click', () => analyzeDocument('answer'));
closeExplain.addEventListener('click', () => {
  explainPopup.style.display = 'none';
});

// Optional: Ctrl+Enter to analyze
editor.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    analyzeDocument();
  }
});
