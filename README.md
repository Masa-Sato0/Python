# Python はじめてエディタ

ブラウザ上でPythonコードを書き、Pyodideで実行できる初心者向け学習Webアプリです。

## ファイル構成

```text
.
├── index.html   # 画面の部品を定義するHTML
├── styles.css   # 見た目を整えるCSS
├── app.js       # 問題データ、エディタ、Python実行処理
└── README.md    # この説明ファイル
```

## 各ファイルの役割

- `index.html`: 問題欄、コードエディタ、実行ボタン、実行結果欄を配置します。
- `styles.css`: PCブラウザで見やすい2カラムレイアウト、ボタン、出力欄などの見た目を設定します。
- `app.js`: 初心者向け問題データ、CodeMirrorエディタの設定、PyodideによるPython実行処理を書いています。

## Webアプリの起動方法

1. このフォルダで簡易Webサーバーを起動します。

   ```bash
   python3 -m http.server 8000
   ```

2. ブラウザで次のURLを開きます。

   ```text
   http://localhost:8000
   ```

> PyodideとCodeMirrorをCDNから読み込むため、初回表示時はインターネット接続が必要です。

## Pythonコードを実行している仕組み

- `index.html`でPyodideを読み込みます。
- `app.js`の`preparePython()`が`loadPyodide()`を呼び、ブラウザ内にPython実行環境を準備します。
- 「実行」ボタンを押すと、`runPythonCode()`がエディタ内のコードを取得します。
- Pythonの`sys.stdout`を一時的に`StringIO`へ切り替え、`print()`の出力を文字列として受け取ります。
- 実行に成功した場合は出力欄に結果を表示し、エラーが起きた場合はエラーメッセージを表示します。

## 初心者が最初に読むべきコードの場所

最初は`app.js`の上部にある`problems`配列を読むのがおすすめです。問題文、ヒント、解答例がまとまっているため、アプリに表示される内容とコードの関係が分かりやすいです。

次に、`runPythonCode()`を見ると、「実行」ボタンを押したあとにPythonコードがどのように動くかを確認できます。
