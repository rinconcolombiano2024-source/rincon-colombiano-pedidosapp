window.__cspEvalBlocked=false;
try { new Function('return 42')(); }
catch (error) { window.__cspEvalBlocked=error instanceof EvalError; }
window.__unauthorizedInlineRan=false;
const probe=document.createElement('script');probe.textContent='window.__unauthorizedInlineRan=true';document.head.append(probe);
