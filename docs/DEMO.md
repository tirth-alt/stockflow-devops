# Final demo script (Part O)

About 15 minutes. Steps follow the order in the course README. **Say** lines are short talking points, not a script to read word for word.

## Before the audience joins (5 min)

```bash
cd ~/Desktop/DevOps-class/stockflow-devops
minikube start -p stockflow                       # cluster with ingress + metrics-server
sudo minikube tunnel -p stockflow                 # terminal 2, keep open (Ingress on macOS)
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090   # terminal 3
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3001:80   # terminal 4
cd ~/actions-runner && ./run.sh                   # terminal 5: self-hosted runner for the deploy job
gh variable set DEPLOY_ENABLED --body true -R tirth-alt/stockflow-devops
docker compose up -d                              # local stack for steps 1–3
```

Open tabs: http://localhost:3000 · http://localhost:8000/docs · GitHub Actions tab · GHCR packages · http://stockflow.local · http://localhost:9090/targets · http://localhost:3001

---

### 1. Application
Open http://localhost:3000 → **Add product** → e.g. "Spirit level 60cm", SKU `LVL-060`, Hand tools, qty 2, reorder at 5, $14.90 → it appears in **Restock needed** (2 ≤ 5).
**Say:** React frontend → Nginx → FastAPI → PostgreSQL. Nginx proxies `/api`, so the browser never needs the backend's hostname.

### 2. API
http://localhost:8000/docs → `POST /api/products` → `GET /api/products/{id}` → `PUT` (change quantity) → `DELETE`. Also show a 409 by posting a duplicate SKU.
**Say:** Pydantic validates input at the boundary: negative quantity → 422, duplicate SKU → 409.

### 3. Database
```bash
docker compose exec postgres psql -U stockflow -c '\d products' -c 'SELECT id, sku, name, quantity FROM products;'
docker compose exec postgres psql -U stockflow -c 'SELECT * FROM alembic_version;'
```
**Say:** the schema is created by an Alembic migration, not by hand, so every environment gets the same schema.

### 4. Git
Make a visible change, e.g. in `frontend/src/main.jsx` change `Main stock room` → `Main stock room · Aisle 4`.
```bash
git checkout -b demo-change && git commit -am "Show aisle number in the header" && git checkout main && git merge --ff-only demo-change
```

### 5. CI
```bash
git push
gh run watch            # or show the Actions tab
```
**Say:** pytest runs first. If a test fails, the pipeline stops and no image is built.

### 6. Docker
```bash
docker images | grep stockflow
```
Show `backend/Dockerfile` (non-root user, `exec uvicorn`) and the multi-stage `frontend/Dockerfile` (Node build stage → Nginx runtime stage, about 80 MB).

### 7. Security
Open the run → `build-scan-push` → **Trivy scan - backend / frontend** steps.
**Say:** Trivy checks OS packages and Python libraries for known CVEs. HIGH or CRITICAL with a fix available → exit code 1 → the pipeline stops before the push. (Real story: the first scan flagged pcre2/libtiff CVEs in an old nginx base image; moving to nginx 1.30 fixed them.)

### 8. Registry
https://github.com/tirth-alt?tab=packages → `stockflow-backend` → tags are commit SHAs, not `latest`.

### 9. Terraform
Walk through `terraform/main.tf` (VPC module: 2 public + 2 private subnets, NAT; EKS module: managed node group). Show the `terraform plan` / AWS Console / `terraform destroy` screenshots in `docs/evidence/`.
**Say:** infrastructure as code: reviewable, repeatable, and destroyable in one command.

### 10. Kubernetes
```bash
kubectl get pods -n stockflow -o wide
kubectl get svc -n stockflow
```
After the deploy job finishes: `kubectl get deploy -n stockflow -o wide`. The image tag equals the new commit SHA, which is **the deployment updating**.

### 11. Helm
```bash
helm list -n stockflow
helm history stockflow -n stockflow          # one revision per deploy
```
Optional: `helm rollback stockflow <previous-revision> -n stockflow`.

### 12. Ingress
http://stockflow.local. The aisle-number change is live.
**Say:** `/` goes to the frontend Service and `/api` to the backend Service. The Ingress is only rules; the nginx Ingress Controller does the actual routing.

### 13. HPA
```bash
kubectl get hpa -n stockflow -w            # terminal A
./scripts/load-test.sh                     # terminal B
```
Watch TARGETS climb past 60% and REPLICAS go 2 → 3 → 4.

### 14. Monitoring
- Prometheus → Status → Targets → `serviceMonitor/stockflow/stockflow-backend` is **UP**.
- Grafana → Dashboards → **StockFlow API**: requests/s, p95 latency, 5xx rate, pod count, CPU, all moving because of the load test.

### 15. Failure simulation
Follow `troubleshooting/README.md`:
1. `kubectl apply -f troubleshooting/broken-image.yaml` → `ImagePullBackOff` → `describe` → wrong tag → `kubectl set image` to a real SHA → Running.
2. `kubectl apply -f troubleshooting/broken-service.yaml` → `get endpoints` shows `<none>` → `--show-labels` → selector typo → patch → endpoints appear.

## After the demo

```bash
gh variable set DEPLOY_ENABLED --body false -R tirth-alt/stockflow-devops
# stop the runner (Ctrl+C), the tunnel and the port-forwards
minikube stop -p stockflow
docker compose down
```

## Likely questions

| Question | Short answer |
|---|---|
| Why tag images with the commit SHA? | Traceability and safe rollback. `latest` changes under you; a SHA never does. |
| Liveness vs readiness? | Liveness failing → restart the container. Readiness failing → stop sending it traffic. |
| Why does HPA need resource requests? | Utilization is measured as a percentage of the CPU *request*. |
| Ingress vs Ingress Controller? | The Ingress is a config object; the controller (nginx) is the pod that routes traffic. |
| Why Terraform if Kubernetes exists? | Kubernetes manages workloads; Terraform creates the cloud resources Kubernetes runs on. |
| What does Trivy not catch? | Bugs in your own code (SAST), leaked secrets in git history (secret scanning), runtime attacks. |
| Postgres in Kubernetes in production? | Usually RDS: managed backups, failover and patching. In-cluster is fine for a demo. |
