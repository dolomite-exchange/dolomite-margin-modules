This package now requires the installation of `safe-tx-hashes` (from Cyfrin) as a CLI tool which can accomplished using
the instructions below.

# Installation

## Curl

```shell
curl -L https://raw.githubusercontent.com/cyfrin/safe-tx-hashes/main/install.sh | bash
```

# Source

You can run scripts directly from this repository.

```shell
git clone https://github.com/Cyfrin/safe-tx-hashes
cd safe-tx-hashes
```

# Optional: Make it a CLI tool

First, make the script executable if it isn't already:

```shell
chmod +x safe_hashes.sh
```

Copy the script to /usr/local/bin (creating a simpler name without the .sh extension):

```shell
sudo cp safe_hashes.sh /usr/local/bin/safe_hashes
```

Ensure the script has the proper permissions:

```shell
sudo chmod 755 /usr/local/bin/safe_hashes
```

Now you can use the script from anywhere by just typing `safe_hashes`.
