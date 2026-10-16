# Troubleshooting lab

## 1. Broken image

```bash
kubectl apply -f troubleshooting/broken-image.yaml
kubectl get pods -n stockflow                      # STATUS: ErrImagePull -> ImagePullBackOff
kubectl describe pod -n stockflow -l app=broken-image   # Events: "manifest unknown" / not found
kubectl get events -n stockflow --sort-by=.lastTimestamp | tail
```

**Diagnosis:** the tag `v9.9.9-does-not-exist` was never pushed to GHCR.
**Fix:** point the Deployment at a tag CI really pushed (a commit SHA), then watch the pod go `Running`:

```bash
kubectl set image deployment/stockflow-broken-image -n stockflow \
  backend=ghcr.io/tirth-alt/stockflow-backend:$(git rev-parse HEAD)
kubectl delete -f troubleshooting/broken-image.yaml     # clean up
```

## 2. Broken Service

```bash
kubectl apply -f troubleshooting/broken-service.yaml
kubectl get svc -n stockflow
kubectl get endpoints -n stockflow stockflow-broken-service   # ENDPOINTS: <none>
kubectl get endpointslices -n stockflow -l kubernetes.io/service-name=stockflow-broken-service  # newer API, same story
kubectl get pods -n stockflow --show-labels | grep backend    # real label: app.kubernetes.io/name=backend
```

**Diagnosis:** a Service finds Pods only through its label selector. `backnd` ≠ `backend`, so it has no endpoints and no traffic.
**Fix:**

```bash
kubectl patch svc stockflow-broken-service -n stockflow \
  -p '{"spec":{"selector":{"app.kubernetes.io/name":"backend"}}}'
kubectl get endpoints -n stockflow stockflow-broken-service   # now lists the backend pod IPs
kubectl delete -f troubleshooting/broken-service.yaml
```

A recorded run of both labs is in [`docs/evidence/troubleshooting-run.txt`](../docs/evidence/troubleshooting-run.txt).
