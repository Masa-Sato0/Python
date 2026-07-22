// 初心者向けの問題データです。問題を増やすときは、この配列に追加します。
const problems = [
  {
    title: "printで文字を表示",
    text: "printを使って、自分の好きなあいさつを表示してください。",
    hint: "文字はダブルクォーテーションで囲みます。例: print(\"こんにちは\")",
    answer: 'print("こんにちは")',
  },
  {
    title: "1から10まで表示",
    text: "1から10までの整数を順番に表示してください。",
    hint: "for と range(1, 11) を使うと、1から10まで繰り返せます。",
    answer: 'for number in range(1, 11):\n    print(number)',
  },
  {
    title: "変数を使う",
    text: "name という変数に自分の名前を入れて、printで表示してください。",
    hint: "変数には name = \"太郎\" のように値を入れます。",
    answer: 'name = "太郎"\nprint(name)',
  },
  {
    title: "足し算",
    text: "12 と 8 を足した結果を表示してください。",
    hint: "足し算には + を使います。",
    answer: 'answer = 12 + 8\nprint(answer)',
  },
  {
    title: "四則演算",
    text: "20から5を引き、結果に3をかけて表示してください。",
    hint: "計算の順番を分かりやすくするために、(20 - 5) * 3 と書けます。",
    answer: 'result = (20 - 5) * 3\nprint(result)',
  },
  {
    title: "ifで条件分岐",
    text: "score が 80 以上なら「合格」、そうでなければ「もう少し」と表示してください。",
    hint: "if score >= 80: の次の行は、スペース4つで字下げします。",
    answer: 'score = 85\nif score >= 80:\n    print("合格")\nelse:\n    print("もう少し")',
  },
  {
    title: "forで繰り返し",
    text: "forを使って「Python楽しい」を3回表示してください。",
    hint: "range(3) は3回繰り返すときに使えます。",
    answer: 'for count in range(3):\n    print("Python楽しい")',
  },
  {
    title: "whileで繰り返し",
    text: "whileを使って、1から5までの数字を表示してください。",
    hint: "数字を表示したあと、number = number + 1 で増やします。",
    answer: 'number = 1\nwhile number <= 5:\n    print(number)\n    number = number + 1',
  },
  {
    title: "listを使う",
    text: "fruits というリストに3つの果物を入れて、forで1つずつ表示してください。",
    hint: "リストは [\"りんご\", \"バナナ\", \"みかん\"] のように作ります。",
    answer: 'fruits = ["りんご", "バナナ", "みかん"]\nfor fruit in fruits:\n    print(fruit)',
  },
  {
    title: "関数を作る",
    text: "nameを受け取って「こんにちは、◯◯さん」と表示する greet 関数を作り、呼び出してください。",
    hint: "def greet(name): で関数を作れます。",
    answer: 'def greet(name):\n    print("こんにちは、" + name + "さん")\n\ngreet("太郎")',
  },
];

const sampleCode = 'print("Hello, Python!")';
let currentProblemIndex = 0;
let pyodide = null;

const outputBox = document.querySelector("#output-box");
const statusLabel = document.querySelector("#status-label");
const runButton = document.querySelector("#run-button");
const resetButton = document.querySelector("#reset-button");
const hintButton = document.querySelector("#hint-button");
const answerButton = document.querySelector("#answer-button");
const nextButton = document.querySelector("#next-button");
const hintBox = document.querySelector("#hint-box");
const answerBox = document.querySelector("#answer-box");

// CodeMirrorで行番号とPythonの色分けがあるエディタを作ります。
const editor = CodeMirror.fromTextArea(document.querySelector("#code-editor"), {
  mode: "python",
  theme: "eclipse",
  lineNumbers: true,
  indentUnit: 4,
  tabSize: 4,
  lineWrapping: true,
});

function showProblem() {
  const problem = problems[currentProblemIndex];
  document.querySelector("#problem-count").textContent = `${currentProblemIndex + 1} / ${problems.length}`;
  document.querySelector("#problem-title").textContent = problem.title;
  document.querySelector("#problem-text").textContent = problem.text;
  hintBox.hidden = true;
  answerBox.hidden = true;
  hintBox.textContent = problem.hint;
  answerBox.textContent = problem.answer;
}

function setOutput(message, type = "normal") {
  outputBox.textContent = message || "出力はありません。";
  outputBox.className = `output-box ${type}`;
}

async function preparePython() {
  runButton.disabled = true;
  pyodide = await loadPyodide();
  statusLabel.textContent = "実行できます";
  statusLabel.className = "status-label status-ready";
  runButton.disabled = false;
}

async function runPythonCode() {
  if (!pyodide) {
    setOutput("Pyodideを読み込み中です。少し待ってからもう一度実行してください。");
    return;
  }

  const code = editor.getValue();
  setOutput("実行中...");

  // Python側の標準出力をStringIOに向け、printの内容を取り出します。
  pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

  try {
    await pyodide.runPythonAsync(code);
    const stdout = pyodide.runPython("sys.stdout.getvalue()");
    setOutput(stdout, "success");
  } catch (error) {
    setOutput(error.message, "error");
  } finally {
    pyodide.runPython("sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__");
  }
}

runButton.addEventListener("click", runPythonCode);
resetButton.addEventListener("click", () => editor.setValue(sampleCode));
hintButton.addEventListener("click", () => { hintBox.hidden = !hintBox.hidden; });
answerButton.addEventListener("click", () => { answerBox.hidden = !answerBox.hidden; });
nextButton.addEventListener("click", () => {
  currentProblemIndex = (currentProblemIndex + 1) % problems.length;
  showProblem();
});

showProblem();
preparePython().catch((error) => {
  statusLabel.textContent = "読み込みエラー";
  statusLabel.className = "status-label status-error";
  setOutput(`Pyodideの読み込みに失敗しました。\n${error.message}`, "error");
});
