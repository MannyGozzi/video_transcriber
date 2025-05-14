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
sudo apt update && sudo apt install python3.11
python3.11 -m venv venv
source venv/bin/activate
pip3 install -U openai-whisper
```

Installing on Ubuntu 25
```bash
sudo add-apt-repository --remove ppa:deadsnakes/ppa
sudo apt update
sudo apt install -y build-essential libssl-dev zlib1g-dev \
  libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm \
  libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev \
  libffi-dev liblzma-dev

# Download and extract Python 3.11 source code
cd /tmp
curl -O https://www.python.org/ftp/python/3.11.9/Python-3.11.9.tgz
tar -xf Python-3.11.9.tgz
cd Python-3.11.9

# Configure and install
./configure --enable-optimizations
make -j$(nproc)
sudo make altinstall
python3.11 -m venv venv
source venv/bin/activate
pip3 install -U openai-whisper
sudo apt install -y ffmpeg
```

For better performance install. Note this may cause compatiblity issues. For example this doesn't work on my M1 Mac.

```bash
pip3 install setuptools-rust
```

## How to run

```bash
bun start -- /path/to/folder/of/mp4s/and/mp3s
```