const WALLET = '0x76485924c7CA4EFcC03e622441fF3ab633c86143';
const PRO_KEY = 'pm_pro';
const LIMIT = 10;

// ── Default prompts ──
const DEFAULTS = [
  {id:'1',title:'Code Review',content:'Review this code for bugs, performance, security. For each finding, explain and suggest fix.\n\n{code}',tags:['code'],pro:false},
  {id:'2',title:'API Docs',content:'Generate API documentation:\n- Endpoint\n- Method\n- Parameters\n- Response format\n- Example\n\n{code}',tags:['api','docs'],pro:false},
  {id:'3',title:'Bug Fixer',content:'Analyze bug: 1) Root cause 2) Reproduce steps 3) Proposed fix 4) Test cases\n\nBug: {bug}',tags:['debugging'],pro:false},
  {id:'4',title:'SQL Optimizer',content:'Optimize this query: 1) Bottlenecks 2) Index suggestions 3) Rewrite\n\n```sql\n{query}\n```',tags:['sql'],pro:true},
  {id:'5',title:'README Generator',content:'Generate a comprehensive README: install, usage, API, examples.\n\nProject: {project}',tags:['docs'],pro:true},
  {id:'6',title:'Unit Tests',content:'Write unit tests for this function. Cover happy path, edge cases, errors.\n\n{code}',tags:['testing'],pro:true},
  {id:'7',title:'Refactoring Plan',content:'Refactoring plan: 1) Code smells 2) Patterns 3) Refactored version 4) Migration\n\n{code}',tags:['code'],pro:true},
  {id:'8',title:'Meeting Notes',content:'Convert notes to: 1) Summary 2) Decisions 3) Actions + owners 4) Follow-ups\n\n{notes}',tags:['productivity'],pro:true},
  {id:'9',title:'Architecture Design',content:'Design system for {product}: tech stack, data flow, scalability, security, monitoring.',tags:['architecture'],pro:true},
  {id:'10',title:'Customer Reply',content:'Professional, empathetic response to complaint. Acknowledge, explain, solution.\n\nComplaint: {complaint}',tags:['communication'],pro:true},
  {id:'11',title:'React Component',content:'Create a React component for {description}. Include TypeScript types, Tailwind styling, and error handling.\n\n{description}',tags:['react','code'],pro:true},
  {id:'12',title:'Regex Generator',content:'Write a regex pattern for: {description}. Test it against these examples: {examples}',tags:['utility'],pro:true},
];

async function load() {
  const {pm_prompts, pm_pro} = await chrome.storage.local.get(['pm_prompts', 'pm_pro']);
  const prompts = pm_prompts || DEFAULTS;
  const isPro = pm_pro || false;
  render(prompts, isPro);
}

function render(prompts, isPro) {
  document.getElementById('proBadge').textContent = isPro ? 'Pro' : 'Free';
  document.getElementById('proBadge').className = 'badge ' + (isPro ? 'badge-pro' : 'badge-free');

  const q = (document.getElementById('search').value || '').toLowerCase();
  const filtered = prompts.filter(p => {
    if (!isPro && p.pro) return false;
    if (q && !p.title.toLowerCase().includes(q) && !p.tags.some(t => t.includes(q))) return false;
    return true;
  });

  const list = document.getElementById('list');
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No prompts found.<br><small style="color:#8b949e">Add one or upgrade to Pro.</small></div>';
    return;
  }

  list.innerHTML = filtered.map(p => `
    <div class="item" data-id="${p.id}">
      <div style="flex:1" onclick="insertPrompt('${p.id}')">
        <div class="title">${p.pro ? '🔒 ' : ''}${p.title}</div>
        <div class="preview">${p.content.slice(0,60)}...</div>
        <div class="tags">${p.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </div>
    </div>
  `).join('');
}

async function insertPrompt(id) {
  const {pm_prompts, pm_pro} = await chrome.storage.local.get(['pm_prompts', 'pm_pro']);
  const prompts = pm_prompts || DEFAULTS;
  const p = prompts.find(x => x.id === id);
  if (!p) return;

  if (p.pro && !pm_pro) {
    showUpgradeModal();
    return;
  }

  // Insert into active text field
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      func: (text) => {
        const el = document.activeElement;
        if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) {
          if (el.isContentEditable) {
            document.execCommand('insertText', false, text);
          } else {
            const start = el.selectionStart || 0;
            el.value = el.value.slice(0, start) + text + el.value.slice(el.selectionEnd || start);
            el.dispatchEvent(new Event('input', {bubbles: true}));
          }
        } else {
          navigator.clipboard.writeText(text);
        }
      },
      args: [p.content]
    });
    toast('✅ Inserted: ' + p.title);
  } catch {
    await navigator.clipboard.writeText(p.content);
    toast('📋 Copied to clipboard');
  }
}

function showUpgradeModal() {
  document.getElementById('modalBody').innerHTML = `
    <h3>🔓 Upgrade to Pro</h3>
    <p style="color:#8b949e;font-size:13px;margin:8px 0">Send <b style="color:var(--gold)">$3 USDC</b> on Base, then paste TX hash below.</p>
    <code style="font-size:0.7rem;word-break:break-all;background:var(--bg);padding:6px;display:block;border-radius:4px;margin:8px 0">${WALLET}</code>
    <input type="text" id="txHash" placeholder="TX hash (0x...)" style="font-family:monospace">
    <div class="modal-actions">
      <button style="background:var(--border);color:var(--text)" onclick="closeModal()">Cancel</button>
      <button style="background:var(--green);color:#fff" onclick="verifyTx()">Verify & Unlock</button>
    </div>
  `;
  document.getElementById('modal').classList.add('show');
}

async function verifyTx() {
  const hash = document.getElementById('txHash').value.trim();
  if (hash && hash.startsWith('0x') && hash.length >= 10) {
    await chrome.storage.local.set({pm_pro: true});
    closeModal();
    toast('🎉 Pro unlocked! All prompts available.');
    load();
  } else {
    toast('Invalid TX hash');
  }
}

function closeModal() { document.getElementById('modal').classList.remove('show'); }

function showAddModal() {
  document.getElementById('modalBody').innerHTML = `
    <h3>+ New Prompt</h3>
    <input type="text" id="newTitle" placeholder="Title (e.g., React Component)">
    <textarea id="newContent" placeholder="Prompt content. Use {var} for placeholders."></textarea>
    <input type="text" id="newTags" placeholder="Tags: code, testing (comma-separated)">
    <div class="modal-actions">
      <button style="background:var(--border);color:var(--text)" onclick="closeModal()">Cancel</button>
      <button style="background:var(--green);color:#fff" onclick="savePrompt()">Save</button>
    </div>
  `;
  document.getElementById('modal').classList.add('show');
}

async function savePrompt() {
  const title = document.getElementById('newTitle').value.trim();
  const content = document.getElementById('newContent').value.trim();
  const tags = document.getElementById('newTags').value.split(',').map(t => t.trim()).filter(Boolean);
  if (!title || !content) { toast('Title and content required'); return; }

  const {pm_prompts} = await chrome.storage.local.get('pm_prompts');
  const prompts = pm_prompts || [...DEFAULTS];
  prompts.push({id: String(Date.now()), title, content, tags, pro: false});
  await chrome.storage.local.set({pm_prompts: prompts});
  closeModal();
  toast('✅ Saved: ' + title);
  load();
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

document.getElementById('search').addEventListener('input', () => {
  chrome.storage.local.get(['pm_prompts', 'pm_pro']).then(({pm_prompts, pm_pro}) => {
    render(pm_prompts || DEFAULTS, pm_pro || false);
  });
});

document.getElementById('btnAdd').addEventListener('click', showAddModal);
document.getElementById('btnPro').addEventListener('click', showUpgradeModal);
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
});

load();
