const patternInput = document.getElementById("pattern");
const flagsInput = document.getElementById("flags");
const testInput = document.getElementById("testString");
const feedback = document.querySelector(".feedback");
const matchOutput = document.getElementById("matchOutput");
const matchDetails = document.getElementById("matchDetails");
const escapePatternButton = document.getElementById("escapePattern");

const DEFAULT_PATTERN = "(?<user>\\w+)@(?<domain>\\w+\\.com)";
const DEFAULT_TEST = `用户邮箱列表：\nalpha@example.com\nbeta@example.com\ninvalid@domain`;

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightMatches(text, regex) {
  if (!text) return "<span class=\"placeholder\">（请输入测试文本）</span>";

  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const iterator = new RegExp(regex.source, flags);
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = iterator.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    parts.push(escapeHtml(text.slice(lastIndex, start)));
    parts.push(`<mark title="匹配：${escapeHtml(match[0])}">${escapeHtml(
      match[0]
    )}</mark>`);
    lastIndex = end;

    if (match[0].length === 0) {
      iterator.lastIndex++;
    }
  }

  parts.push(escapeHtml(text.slice(lastIndex)));

  if (parts.length === 1) {
    return `<span class=\"placeholder\">（未匹配到结果）</span>`;
  }

  return parts.join("");
}

function escapeRegexLiteral(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function renderMatchDetails(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const iterator = new RegExp(regex.source, flags);
  const matches = Array.from(text.matchAll(iterator));

  if (matches.length === 0) {
    matchDetails.innerHTML = `<p class=\"placeholder\">未捕获到任何匹配。</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  matches.forEach((match, index) => {
    const card = document.createElement("article");
    card.className = "match-card";

    const heading = document.createElement("h3");
    heading.textContent = `匹配 #${index + 1} （索引 ${match.index}）`;
    card.appendChild(heading);

    const summary = document.createElement("p");
    summary.innerHTML = `匹配文本：<code>${escapeHtml(match[0])}</code>`;
    card.appendChild(summary);

    if (match.groups && Object.keys(match.groups).length > 0) {
      const list = document.createElement("ul");
      for (const [name, value] of Object.entries(match.groups)) {
        const item = document.createElement("li");
        item.innerHTML = `命名分组 <code>${escapeHtml(name)}</code> → <code>${escapeHtml(
          value ?? ""
        )}</code>`;
        list.appendChild(item);
      }
      card.appendChild(list);
    } else if (match.length > 1) {
      const list = document.createElement("ul");
      match.slice(1).forEach((groupValue, idx) => {
        const item = document.createElement("li");
        item.innerHTML = `分组 ${idx + 1} → <code>${escapeHtml(
          groupValue ?? ""
        )}</code>`;
        list.appendChild(item);
      });
      card.appendChild(list);
    }

    fragment.appendChild(card);
  });

  matchDetails.innerHTML = "";
  matchDetails.appendChild(fragment);
}

function updateView() {
  const pattern = patternInput.value;
  const flags = flagsInput.value;
  const testText = testInput.value;

  if (!pattern) {
    feedback.textContent = "请输入正则表达式";
    matchOutput.innerHTML = "<span class=\"placeholder\">等待输入...</span>";
    matchDetails.innerHTML = "";
    return;
  }

  try {
    const regex = new RegExp(pattern, flags);
    feedback.textContent = "";
    matchOutput.innerHTML = highlightMatches(testText, regex);
    renderMatchDetails(testText, regex);
  } catch (error) {
    feedback.textContent = `语法错误：${error.message}`;
    matchOutput.innerHTML = "<span class=\"placeholder\">无法解析正则表达式</span>";
    matchDetails.innerHTML = "";
  }
}

function init() {
  patternInput.value = DEFAULT_PATTERN;
  flagsInput.value = "g";
  testInput.value = DEFAULT_TEST;
  updateView();
}

patternInput.addEventListener("input", updateView);
flagsInput.addEventListener("input", updateView);
testInput.addEventListener("input", updateView);
escapePatternButton.addEventListener("click", () => {
  patternInput.value = escapeRegexLiteral(patternInput.value);
  updateView();
  patternInput.focus();
  const length = patternInput.value.length;
  patternInput.setSelectionRange(length, length);
});

document.addEventListener("DOMContentLoaded", init);
