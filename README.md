# StockFlow: inventory management, shipped the DevOps way

StockFlow is a small inventory system for a hardware store's stock room. Staff can:

- add, edit and delete products (name, SKU, category, quantity, reorder level, unit price, supplier)
- adjust stock with one click as items are sold or received
- see what is **running low** (quantity at or below its reorder level) and what is **out of stock**, with a restock queue at the top of the page
- see the total value of the inventory on the shelves

The app itself is intentionally small. The project is about taking it from a laptop to a monitored Kubernetes cluster: tests, containers, a CI/CD pipeline with a security gate, a container registry, infrastructure as code, Helm, Ingress, autoscaling, monitoring and troubleshooting.

![StockFlow dashboard](docs/evidence/app-desktop.png)

**Slide deck:** [`demo/stockflow-presentation.pptx`](demo/stockflow-presentation.pptx) (PDF: [`demo/stockflow-presentation.pdf`](demo/stockflow-presentation.pdf)).
**Submission:** [`docs/SUBMISSION.md`](docs/SUBMISSION.md) maps every GRADING.md deliverable to its file or screenshot in [`docs/evidence/`](docs/evidence/).
**Demo video (2 min):** [`demo/stockflow-demo.mp4`](demo/stockflow-demo.mp4). It shows a header change committed, the pipeline running (sped up), the new image SHA rolled out by Helm, and the change live through the Ingress.

## Architecture

```text
Developer ──git push──▶ GitHub ──▶ GitHub Actions
                                    ├─ test:   pytest + frontend build      (fails → pipeline stops)
                                    ├─ build:  2 Docker images tagged with the commit SHA
                                    ├─ scan:   Trivy, fail on HIGH/CRITICAL (fails → nothing is pushed)
                                    ├─ push:   ghcr.io/tirth-alt/stockflow-{backend,frontend}:<sha>
                                    └─ deploy: helm upgrade --install (self-hosted runner → cluster)

Terraform ──▶ AWS: VPC (2 public + 2 private subnets, NAT) + EKS 1.36 + managed node group

Kubernetes (namespace: stockflow), installed with Helm
   Ingress (nginx) stockflow.local
     ├── /     ──▶ Service frontend ──▶ 2 × Nginx + React pods
     └── /api  ──▶ Service backend  ──▶ 2–6 × FastAPI pods  ◀── HPA (CPU 60%)
                                              │
                                              └──▶ Service postgres ──▶ PostgreSQL + PVC
   Prometheus ──scrapes /metrics (ServiceMonitor)──▶ backend
   Grafana    ──▶ "StockFlow API" dashboard (requests/s, p95 latency, 5xx rate, pods, CPU)
```

| Layer | Technology | Where |
|---|---|---|
| Frontend | React 19 + Vite, plain CSS, served by Nginx (non-root) | `frontend/` |
| Backend | FastAPI, SQLAlchemy 2, Pydantic, Prometheus instrumentator | `backend/app/` |
| Database | PostgreSQL 16, schema managed by Alembic | `backend/alembic/` |
| Tests | pytest with an isolated in-memory SQLite DB | `backend/tests/` |
| Containers | Dockerfiles + Docker Compose | `*/Dockerfile`, `docker-compose.yml` |
| CI/CD | GitHub Actions | `.github/workflows/ci-cd.yml` |
| Security | Trivy image scan (HIGH/CRITICAL gate) | CI `build-scan-push` job |
| Registry | GitHub Container Registry (GHCR) | `ghcr.io/tirth-alt/stockflow-*` |
| Infrastructure | Terraform: AWS VPC + EKS | `terraform/` |
| Deployment | Helm chart, Ingress, HPA | `helm/stockflow/`, `k8s/` |
| Monitoring | kube-prometheus-stack (Prometheus + Grafana) | `monitoring/` |
| Troubleshooting | Deliberately broken manifests | `troubleshooting/` |

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness: the process is up (no DB call) |
| GET | `/ready` | Readiness: the database answers |
| GET | `/metrics` | Prometheus metrics |
| GET | `/api/products` | List products |
| GET | `/api/products/{id}` | Get one product |
| POST | `/api/products` | Create a product (409 on duplicate SKU, 422 on invalid input) |
| PUT | `/api/products/{id}` | Update a product (partial updates allowed) |
| DELETE | `/api/products/{id}` | Delete a product |
| GET | `/api/products/stats` | Totals: products, units, low stock, out of stock, inventory value |

Interactive docs: `http://localhost:8000/docs` (Swagger UI).

## Run it locally (Docker Compose)

```bash
docker compose up --build
```

- App: http://localhost:3000
- API docs: http://localhost:8000/docs · health: http://localhost:8000/health · metrics: http://localhost:8000/metrics

The backend waits for PostgreSQL to be healthy, runs `alembic upgrade head`, then starts Uvicorn.
Stop with `docker compose down` (add `-v` to delete the database volume).

Look at the table directly:

```bash
docker compose exec postgres psql -U stockflow -c 'SELECT id, sku, name, quantity FROM products;'
```

## Run the backend without Docker

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export DATABASE_URL='postgresql+psycopg://stockflow:stockflow@localhost:5432/stockflow'
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Frontend dev server (proxies `/api` to port 8000): `cd frontend && npm install && npm run dev`.

## Tests

```bash
cd backend && pytest
```

11 tests cover health/readiness/metrics and every product endpoint, including validation (422), duplicate SKU (409) and not-found (404).
`tests/conftest.py` swaps the database dependency for an in-memory SQLite database, so tests never touch PostgreSQL.
In CI the tests run **before** any image is built: bad code fails the pipeline and no broken image reaches the registry.

## CI/CD pipeline

`.github/workflows/ci-cd.yml` runs on every push and pull request to `main`:

1. **test**: install dependencies, `pytest`, `npm ci && npm run build`.
2. **build-scan-push**: build both images tagged with `${{ github.sha }}`, scan each with Trivy (`HIGH,CRITICAL`, `exit-code: 1`, unfixed CVEs ignored), then push to GHCR (push events only).
3. **deploy**: `helm upgrade --install` with the new SHA tags. It runs on a self-hosted runner on the machine that hosts the cluster, and only when the repository variable `DEPLOY_ENABLED` is `true`.

Every running image can be traced to the commit that built it: `commit abc123 → stockflow-backend:abc123`.

The Trivy action is pinned to a full commit SHA. In March 2026 the `trivy-action` version tags were hijacked to ship credential-stealing code (CVE-2026-33634), and SHA pinning protects against that kind of attack.

## Infrastructure (Terraform → AWS)

See [`terraform/README.md`](terraform/README.md). Summary:

```bash
aws configure
cd terraform && terraform init && terraform plan -out tfplan && terraform apply tfplan
$(terraform output -raw configure_kubectl)
terraform destroy
```

Always run `terraform destroy` when you're finished: the stack costs about $0.25/hour while it runs.

## Kubernetes with Helm (minikube)

> These commands have `# notes` after them. In zsh (the macOS default), run `setopt interactivecomments` once per terminal, or add it to `~/.zshrc`. Otherwise zsh passes the note to the command as extra arguments.

```bash
minikube start -p stockflow --memory=3500 --cpus=4 --addons=ingress,metrics-server
kubectl apply -f k8s/namespace.yaml

# Monitoring first: it provides the ServiceMonitor CRD the chart uses
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace -f monitoring/kube-prometheus-stack-values.yaml

# The app, pinned to the images CI built for the current commit
SHA=$(git rev-parse HEAD)
helm upgrade --install stockflow ./helm/stockflow -n stockflow \
  -f helm/stockflow/values-dev.yaml --set backend.tag=$SHA --set frontend.tag=$SHA --wait

kubectl get pods,svc,ingress,hpa -n stockflow
helm list -n stockflow
```

**Ingress on macOS (Docker driver):** add the hostname once with `echo "127.0.0.1 stockflow.local" | sudo tee -a /etc/hosts`, then either:

- `sudo minikube tunnel -p stockflow` and open http://stockflow.local, or
- without sudo: `kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80` and open http://stockflow.local:8080.

Either way the request goes through the nginx Ingress controller, which routes by hostname. macOS tries mDNS for `.local` names first, so the first request can take about 5 seconds.

**Autoscaling:** `./scripts/load-test.sh`, and in another terminal `kubectl get hpa -n stockflow -w`.

**Monitoring:**

```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090    # Status → Targets
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3001:80     # Dashboards → StockFlow API
kubectl get secret -n monitoring kube-prometheus-stack-grafana -o jsonpath='{.data.admin-password}' | base64 -d
```

**Troubleshooting labs:** see [`troubleshooting/README.md`](troubleshooting/README.md) (ImagePullBackOff, and a Service with no endpoints).

## Design decisions

- **`/health` vs `/ready`**: liveness must not depend on the DB. If it did, a database blip would make Kubernetes restart every healthy backend pod. Readiness does check the DB, so pods only receive traffic when they can serve it.
- **Migrations at container start, with a Postgres advisory lock**: several backend replicas start together, and the lock makes them run `alembic upgrade` one at a time instead of racing.
- **Non-root containers**: the backend runs as UID 10001, and the frontend uses `nginx-unprivileged` (UID 101, port 8080). Both Deployments set `runAsNonRoot: true`.
- **No `latest` tags**: the chart refuses to render without an explicit image tag, and CI always passes the commit SHA.
- **PostgreSQL in the cluster** keeps the classroom demo self-contained. On AWS, Amazon RDS would be the better choice (backups, failover and patching handled for you), and the chart would just get a different `DATABASE_URL`.
- **EKS 1.36**: a version in extended support costs $0.60/h for the control plane instead of $0.10/h.

## Repository layout

```text
backend/            FastAPI app, Alembic migrations, pytest suite, Dockerfile
frontend/           React app, Nginx config template, multi-stage Dockerfile
docker-compose.yml  Full local stack (postgres, backend, frontend)
.github/workflows/  CI/CD pipeline
terraform/          AWS VPC + EKS
k8s/                Namespace manifest
helm/stockflow/     Helm chart (deployments, services, ingress, HPA, ServiceMonitor, dashboard)
monitoring/         kube-prometheus-stack values (Prometheus + Grafana)
troubleshooting/    Broken manifests + walkthrough
scripts/            HPA load test
demo/               Demo video and slide deck (pptx + pdf)
docs/               Demo script, submission checklist, evidence screenshots
```
