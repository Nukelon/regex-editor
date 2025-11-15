const regexInput = document.getElementById('regex-input');
const sampleInput = document.getElementById('sample-input');
const flagContainer = document.getElementById('flag-container');
const visualisation = document.getElementById('visualisation');
const tokenTable = document.getElementById('token-table');
const matchPreview = document.getElementById('match-preview');
const matchDetail = document.getElementById('match-detail');
const replacementInput = document.getElementById('replacement-input');
const replacementBtn = document.getElementById('replacement-btn');
const replacementOutput = document.getElementById('replacement-output');

const defaultRegex = '^\\w+(?:[.-]\\w+)*@\\w+(?:[.-]\\w+)*\\.\\w+$';
const defaultText = `欢迎来到正则编辑器!\n示例邮箱: test@example.com, foo.bar@domain.io\n示例订单号: ORD-2048`; 

regexInput.value = defaultRegex;
sampleInput.value = defaultText;
document.querySelector('input[value="g"]').checked = true;
document.querySelector('input[value="i"]').checked = true;

function getFlags() {
  return Array.from(flagContainer.querySelectorAll('input:checked'))
    .map((input) => input.value)
    .join('');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });
}

function describeEscape(char) {
  const map = {
    d: '数字字符 (0-9)',
    D: '非数字字符',
    w: '单词字符 (字母、数字、下划线)',
    W: '非单词字符',
    s: '空白字符 (空格、制表、换行)',
    S: '非空白字符',
    t: '制表符',
    n: '换行符',
    r: '回车符',
    b: '单词边界',
    B: '非单词边界',
    f: '换页符',
    v: '垂直制表符',
    0: '空字符',
  };
  return map[char] || `转义字符 ${char}`;
}

function describeQuantifier(raw) {
  if (raw === '*') return '重复 0 次或多次 (贪婪)';
  if (raw === '+') return '重复 1 次或多次 (贪婪)';
  if (raw === '?') return '重复 0 次或 1 次 (贪婪)';
  if (raw.endsWith('?')) return `${describeQuantifier(raw.slice(0, -1))}，懒惰模式`;
  return '自定义重复次数';
}

function tokenizeRegex(pattern) {
  const tokens = [];
  let i = 0;
  let escaping = false;
  while (i < pattern.length) {
    const char = pattern[i];

    if (escaping) {
      tokens.push({
        type: 'escaped',
        raw: `\\${char}`,
        description: describeEscape(char),
      });
      escaping = false;
      i += 1;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      i += 1;
      continue;
    }

    if (char === '[') {
      let buffer = '[';
      let innerEscape = false;
      i += 1;
      while (i < pattern.length) {
        const current = pattern[i];
        buffer += current;
        if (!innerEscape && current === ']') {
          i += 1;
          break;
        }
        if (!innerEscape && current === '\\') {
          innerEscape = true;
        } else {
          innerEscape = false;
        }
        i += 1;
      }
      tokens.push({
        type: 'set',
        raw: buffer,
        description: '字符集合',
      });
      continue;
    }

    if (char === '(') {
      let raw = '(';
      let desc = '捕获分组开始';
      let j = i + 1;
      if (pattern[j] === '?') {
        raw += '?';
        j += 1;
        const next = pattern[j];
        switch (next) {
          case ':':
            raw += ':';
            desc = '非捕获分组开始';
            j += 1;
            break;
          case '=':
            raw += '=';
            desc = '正向前瞻开始';
            j += 1;
            break;
          case '!':
            raw += '!';
            desc = '负向前瞻开始';
            j += 1;
            break;
          case '<': {
            raw += '<';
            j += 1;
            const look = pattern[j];
            if (look === '=') {
              raw += '=';
              desc = '正向后顾开始';
              j += 1;
            } else if (look === '!') {
              raw += '!';
              desc = '负向后顾开始';
              j += 1;
            } else {
              let name = '';
              while (j < pattern.length && pattern[j] !== '>') {
                name += pattern[j];
                raw += pattern[j];
                j += 1;
              }
              if (pattern[j] === '>') {
                raw += '>';
                j += 1;
              }
              desc = `命名捕获分组开始 (${name || 'name'})`;
            }
            break;
          }
          default:
            break;
        }
      }
      tokens.push({ type: 'group', raw, description: desc });
      i = j;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'group', raw: ')', description: '分组结束' });
      i += 1;
      continue;
    }

    if (char === '^' || char === '$') {
      tokens.push({
        type: 'anchor',
        raw: char,
        description: char === '^' ? '字符串开头锚点' : '字符串结尾锚点',
      });
      i += 1;
      continue;
    }

    if (char === '|') {
      tokens.push({ type: 'operator', raw: '|', description: '分支选择 (或)' });
      i += 1;
      continue;
    }

    if (char === '.') {
      tokens.push({ type: 'wildcard', raw: '.', description: '除换行符外的任意单字符' });
      i += 1;
      continue;
    }

    if ('*+?'.includes(char)) {
      tokens.push({ type: 'quantifier', raw: char, description: describeQuantifier(char) });
      i += 1;
      continue;
    }

    if (char === '{') {
      let buffer = '{';
      i += 1;
      while (i < pattern.length && pattern[i] !== '}') {
        buffer += pattern[i];
        i += 1;
      }
      if (pattern[i] === '}') {
        buffer += '}';
        i += 1;
      }
      tokens.push({ type: 'quantifier', raw: buffer, description: describeQuantifier(buffer) });
      continue;
    }

    tokens.push({ type: 'literal', raw: char, description: `字面量字符 ${char}` });
    i += 1;
  }
  return tokens;
}

function renderVisualisation(tokens, error) {
  if (error) {
    visualisation.innerHTML = `<div class="error">无法解析表达式：${escapeHtml(error.message)}</div>`;
    return;
  }
  if (!tokens.length) {
    visualisation.innerHTML = '<p class="muted">输入正则以查看语法结构。</p>';
    return;
  }
  visualisation.innerHTML = tokens
    .map((token) => {
      const type = token.type;
      return `<span class="token-node" data-type="${type}"><strong>${escapeHtml(token.raw)}</strong><span>${escapeHtml(token.description)}</span></span>`;
    })
    .join('');
}

function renderTokenTable(tokens, error) {
  if (error) {
    tokenTable.innerHTML = '';
    return;
  }
  if (!tokens.length) {
    tokenTable.innerHTML = '';
    return;
  }
  tokenTable.innerHTML = tokens
    .map((token) => `<div class="token-row"><code>${escapeHtml(token.raw)}</code><span>${escapeHtml(token.description)}</span></div>`)
    .join('');
}

function renderMatches(regex, error) {
  if (error) {
    matchPreview.innerHTML = `<span class="error">${escapeHtml(error.message)}</span>`;
    matchDetail.innerHTML = '';
    return;
  }
  const text = sampleInput.value;
  if (!regex || !text) {
    matchPreview.textContent = text || '输入测试文本以查看匹配结果';
    matchDetail.innerHTML = '';
    return;
  }
  let lastIndex = 0;
  let output = '';
  const matches = [];
  let iteration = 0;
  const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  let result;
  while ((result = globalRegex.exec(text)) !== null) {
    if (iteration++ > 1000) break; // 防御性退出
    const matchText = result[0];
    const start = result.index;
    const end = start + matchText.length;
    output += escapeHtml(text.slice(lastIndex, start));
    if (matchText === '') {
      output += '<mark></mark>';
      matches.push({ matchText, groups: result.slice(1), index: start });
      lastIndex = start;
      globalRegex.lastIndex += 1;
      if (globalRegex.lastIndex > text.length) break;
      continue;
    }
    const groupChips = result.length > 1
      ? result
          .slice(1)
          .map((group, idx) => `<span class="group-chip">$${idx + 1}: ${escapeHtml(group ?? '')}</span>`)
          .join('')
      : '';
    output += `<mark>${escapeHtml(matchText)}${groupChips}</mark>`;
    lastIndex = end;
    matches.push({ matchText, groups: result.slice(1), index: start });
    if (matchText.length === 0) {
      globalRegex.lastIndex += 1;
    }
  }
  output += escapeHtml(text.slice(lastIndex));
  matchPreview.innerHTML = output || escapeHtml(text);
  if (!matches.length) {
    matchDetail.innerHTML = '<p class="muted">无匹配结果</p>';
    return;
  }
  matchDetail.innerHTML = matches
    .map((item, idx) => {
      const groups = item.groups
        .map((value, gIdx) => `<dt>$${gIdx + 1}</dt><dd>${escapeHtml(value ?? '')}</dd>`)
        .join('');
      return `<article class="match-item"><header>#${idx + 1} @ ${item.index}</header><dl>${groups || '<dt>匹配</dt><dd>无捕获组</dd>'}</dl></article>`;
    })
    .join('');
}

function buildRegex() {
  const pattern = regexInput.value;
  const flags = getFlags();
  try {
    return { regex: new RegExp(pattern, flags), error: null };
  } catch (error) {
    return { regex: null, error };
  }
}

function updateView() {
  const { regex, error } = buildRegex();
  const tokens = error ? [] : tokenizeRegex(regexInput.value);
  renderVisualisation(tokens, error);
  renderTokenTable(tokens, error);
  renderMatches(regex, error);
}

function insertAtCursor(textarea, value) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = `${before}${value}${after}`;
  const caret = start + value.length;
  textarea.selectionStart = caret;
  textarea.selectionEnd = caret;
  textarea.focus();
}

function applyTemplate(textarea, template) {
  const placeholder = '‖';
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);
  const placeholderIndex = template.indexOf(placeholder);
  let insertText = template;
  let caretPosition = start;
  if (placeholderIndex !== -1) {
    if (selected) {
      insertText = template.replace(placeholder, selected);
      caretPosition = start + placeholderIndex + selected.length;
    } else {
      insertText = template.replace(placeholder, '');
      caretPosition = start + placeholderIndex;
    }
  } else {
    caretPosition = start + template.length;
  }
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = `${before}${insertText}${after}`;
  textarea.selectionStart = caretPosition;
  textarea.selectionEnd = caretPosition;
  textarea.focus();
}

function handleToolbarClick(event) {
  const target = event.target.closest('button');
  if (!target) return;
  const insert = target.dataset.insert;
  const wrap = target.dataset.wrap;
  const template = target.dataset.template;
  if (insert) {
    insertAtCursor(regexInput, insert);
  } else if (wrap) {
    const start = regexInput.selectionStart;
    const end = regexInput.selectionEnd;
    const selected = regexInput.value.slice(start, end);
    const before = regexInput.value.slice(0, start);
    const after = regexInput.value.slice(end);
    const open = wrap[0];
    const close = wrap[1] || wrap[0];
    regexInput.value = `${before}${open}${selected}${close}${after}`;
    const caretStart = start + open.length;
    const caretEnd = caretStart + selected.length;
    regexInput.selectionStart = caretStart;
    regexInput.selectionEnd = caretEnd;
    regexInput.focus();
  } else if (template) {
    applyTemplate(regexInput, template);
  }
  updateView();
}

document.querySelector('.toolbar').addEventListener('click', handleToolbarClick);
regexInput.addEventListener('input', updateView);
sampleInput.addEventListener('input', () => updateView());
Array.from(flagContainer.querySelectorAll('input')).forEach((input) => {
  input.addEventListener('change', updateView);
});

replacementBtn.addEventListener('click', () => {
  const { regex, error } = buildRegex();
  if (error) {
    replacementOutput.innerHTML = `<span class="error">${escapeHtml(error.message)}</span>`;
    return;
  }
  if (!regex) {
    replacementOutput.textContent = '请输入有效的正则表达式';
    return;
  }
  try {
    const result = sampleInput.value.replace(regex, replacementInput.value);
    replacementOutput.textContent = result;
  } catch (err) {
    replacementOutput.innerHTML = `<span class="error">${escapeHtml(err.message)}</span>`;
  }
});

updateView();
