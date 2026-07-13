#!/bin/sh
set -e

mkdir -p /root/.ssh
chmod 700 /root/.ssh

if [ -f /root/.ssh/id_ed25519 ]; then
  # bind-mount costuma vir com permissão larga; SSH exige 600
  cp /root/.ssh/id_ed25519 /root/.ssh/id_netcar
  chmod 600 /root/.ssh/id_netcar
  if [ -z "${SSH_KEY_PATH:-}" ]; then
    export SSH_KEY_PATH=/root/.ssh/id_netcar
  fi
fi

if [ ! -f /root/.ssh/known_hosts ]; then
  touch /root/.ssh/known_hosts
  chmod 644 /root/.ssh/known_hosts
fi

# volume montado de outro UID → git reclama de "dubious ownership"
git config --global --add safe.directory /workspace || true
git config --global --add safe.directory /workspace/dist || true

exec node server/index.js
