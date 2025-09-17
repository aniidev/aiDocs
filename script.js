// DOM references
const editor = document.getElementById("editor");
const contextMenu = document.getElementById("contextMenu");
const feedbackEl = document.getElementById("feedback");

const explainPopup = document.getElementById("explainPopup");
const explainContent = document.getElementById("explainContent");
const closeExplain = document.getElementById("closeExplain");


let savedRange = null;
editor.addEventListener('mouseup', saveSelection);
editor.addEventListener('keyup', saveSelection);
editor.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  saveSelection(); // make sure selection is saved

  // Position and show context menu
  contextMenu.style.top = `${e.pageY}px`;
  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.display = 'block';
});


// Helpers
function getDocumentText() {
  return editor.innerText.replace(/\u00A0/g, " ").trim();
}

function setEditorText(text) {
  editor.innerText = text;
}

function getSelectedRange() {
  return savedRange;
}

function saveSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    savedRange = sel.getRangeAt(0);
  }
}

// Answer / Explain 
async function analyzeDocument(mode = "full") {
  let range = null;
  let textToSend = "";

  if (mode === "explain") {
    range = getSelectedRange();
    if (!range || range.toString().trim() === "") {
      feedbackEl.innerText = "Select some text first.";
      return;
    }
    textToSend = range.toString();
  } else {
    textToSend = getDocumentText();
  }

  feedbackEl.innerText = "Analyzing...";

  try {
    const res = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: textToSend, mode })
    });
    if (!res.ok) throw new Error("server error");

    let data = await res.json();

    // Ensure JSON parsing
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = { updatedText: textToSend, feedback: "AI returned raw text." };
      }
    }

    if (mode === "explain") {
      explainContent.innerHTML = "";
      (data.highlights || []).forEach((h) => {
        const div = document.createElement("div");
        div.style.marginBottom = "8px";
        div.innerHTML = `${h.explanation || "No explanation."}`;
        explainContent.appendChild(div);
      });
      explainPopup.style.display = "block";
    } else if (range) {
      const updated = data.updatedText || textToSend;
      range.deleteContents();
      range.insertNode(document.createTextNode(updated));
      feedbackEl.innerText = "AI updated selected text.";
    } else {
      setEditorText(data.updatedText || textToSend);
      feedbackEl.innerText = "AI updated the document.";
    }
  } catch (err) {
    console.error(err);
    feedbackEl.innerText = "Error contacting server.";
  }
}

// Context menu handling
editor.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  contextMenu.style.display = "block";
  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.top = `${e.pageY}px`;
});

document.addEventListener("click", () => {
  contextMenu.style.display = "none";
});

contextMenu.addEventListener("click", (e) => {
  const action = e.target.getAttribute("data-action");
  if (action) {
    analyzeDocument(action);
    contextMenu.style.display = "none";
  }
});

// Close explanation popup
closeExplain.addEventListener("click", () => {
  explainPopup.style.display = "none";
});

// Ctrl+Enter to run full analysis
editor.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    analyzeDocument("full");
  }
});
