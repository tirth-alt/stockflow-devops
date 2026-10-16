#!/usr/bin/env bash
# Generates CPU load on the backend so the HPA scales it out.
# Runs a busybox pod inside the cluster that hammers the stats endpoint (it runs a DB aggregate).
#   ./scripts/load-test.sh          # default 3 minutes
#   DURATION=300 ./scripts/load-test.sh
set -euo pipefail
NAMESPACE="${NAMESPACE:-stockflow}"
DURATION="${DURATION:-180}"
URL="http://stockflow-backend.${NAMESPACE}:8000/api/products/stats"

echo "Hitting $URL for ${DURATION}s. In another terminal: kubectl get hpa -n $NAMESPACE -w"
kubectl run load-generator -n "$NAMESPACE" --rm -i --restart=Never --image=busybox:1.37 -- \
  sh -c "end=\$((\$(date +%s)+$DURATION)); for w in 1 2 3 4 5 6 7 8; do (while [ \$(date +%s) -lt \$end ]; do wget -q -O /dev/null $URL; done) & done; wait"
echo "Load test finished. The HPA scales back down after its ~5 minute stabilisation window."
