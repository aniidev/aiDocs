// DOM references
const editor = document.getElementById("editor");
const contextMenu = document.getElementById("contextMenu");
const feedbackEl = document.getElementById("feedback");

const explainPopup = document.getElementById("explainPopup");
const explainContent = document.getElementById("explainContent");
const closeExplain = document.getElementById("closeExplain");

let savedRange = null;
editor.addEventListener("mouseup", saveSelection);
editor.addEventListener("keyup", saveSelection);

// Context menu (single handler, keeps selection)
editor.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  saveSelection(); // ensure selection is saved
  contextMenu.style.top = `${e.pageY}px`;
  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.display = "block";
});

document.addEventListener("click", () => {
  contextMenu.style.display = "none";
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

// Insert AI suggestion with Keep/Delete options
function insertSuggestion(range, original, updated) {
  const suggestion = document.createElement("span");
  suggestion.className = "ai-suggestion";
  
  const highlighted = document.createElement("span");
  highlighted.className = "highlighted-text";
  highlighted.textContent = updated;
  suggestion.appendChild(highlighted);

  const actions = document.createElement("span");
  actions.className = "actions";
  actions.innerHTML = `<span class="keep">✔</span><span class="delete">✖</span>`;
  suggestion.appendChild(actions);

  range.deleteContents();
  range.insertNode(suggestion);

  const keepFn = () => {
    const plain = document.createTextNode(updated);
    suggestion.replaceWith(plain);
    feedbackEl.innerText = "Kept AI suggestion.";
    document.removeEventListener("keydown", enterHandler); // cleanup
  };

  const deleteFn = () => {
    const plain = document.createTextNode(original);
    suggestion.replaceWith(plain);
    feedbackEl.innerText = "Deleted AI suggestion.";
    document.removeEventListener("keydown", enterHandler); // cleanup
  };

  // Click handlers
  actions.querySelector(".keep").addEventListener("click", keepFn);
  actions.querySelector(".delete").addEventListener("click", deleteFn);

  // Enter key accepts suggestion
  const enterHandler = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      keepFn();
    }
  };

  document.addEventListener("keydown", enterHandler);
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
    } else if ((range = getSelectedRange())) {
      const updated = data.updatedText || textToSend;
      insertSuggestion(range, textToSend, updated);
      feedbackEl.innerText = "AI suggested an edit.";
    } else {
      const updated = data.updatedText || textToSend;
      setEditorText(updated);
      feedbackEl.innerText = "AI updated the document.";
    }
  } catch (err) {
    console.error(err);
    feedbackEl.innerText = "Error contacting server.";
  }
}

// Context menu action
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

// Ctrl+Enter = analyze whole doc
editor.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    analyzeDocument("full");
  }
});
