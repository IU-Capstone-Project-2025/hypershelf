#!/bin/bash

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <vsphere_hostname> <hypershelf_host>"
  echo "Example: $0 192.168.1.100 http://hypershelf.local"
  exit 1
fi

ip_address="$1"
hypershelf_host="$2"

sed "s|\\\$VSPHERE_HOSTNAME\\\$|$ip_address|g" manifest.sample.json > manifest.json
sed "s|\\\$HYPERSHELF_HOST\\\$|$hypershelf_host|g" content.sample.js > content.js

echo "Done"
