#!/usr/bin/env bash
set -euo pipefail
kubectl get --raw='/readyz'
printf '\n'
kubectl get nodes -o wide
kubectl get pods -A
kubectl get tigerastatus
kubectl -n lab get deployment,service,pdb
