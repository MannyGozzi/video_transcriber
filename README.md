# transcriber

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.10. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.


## Prequisites

Install python 3.11

MacOS
```bash
brew install python@3.11
```

Unix
```bash
sudo apt update && sudo apt install python3.11
```

Installing whisper
```bash
python3.11 -m venv venv
source venv/bin/activate
pip3 install -U openai-whisper
```

For better performance install. Note this may cause compatiblity issues. For example this doesn't work on my M1 Mac.

```bash
pip3 install setuptools-rust
```