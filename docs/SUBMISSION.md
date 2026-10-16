# Submission: StockFlow (Session 21 DevOps capstone)

- **Repository:** https://github.com/tirth-alt/stockflow-devops (public)
- **Domain:** inventory management for a hardware store's stock room (own domain, not the TaskBoard reference)
- **Demo video:** [`docs/demo/stockflow-demo.mp4`](demo/stockflow-demo.mp4): change → commit → CI pipeline → deploy → new version live through the Ingress
- **Evidence:** every screenshot and log below is in [`docs/evidence/`](evidence/). Screenshots were taken of real Terminal.app and Chrome windows on the demo Mac. The AWS Console shots were taken by me in the console.

Each section lists GRADING.md's "What to Submit" items for that module, and where each one is.

## M1 Application (10)

| What to submit | Where |
|---|---|
| `backend/app/` (models, schemas, routes, DB config) | [`backend/app/`](../backend/app/): `models.py`, `schemas.py`, `main.py`, `db.py`, `config.py` |
| `backend/alembic/versions/` (≥ 1 migration) | [`0001_create_products.py`](../backend/alembic/versions/0001_create_products.py) |
| `backend/requirements.txt` | [`backend/requirements.txt`](../backend/requirements.txt) |
| `frontend/` | [`frontend/`](../frontend/) (React + Vite, `src/main.jsx`, `src/styles.css`) |
| `docker-compose.yml` | [`docker-compose.yml`](../docker-compose.yml) |
| Screenshot/recording of the app in the browser | [`app-desktop.png`](evidence/app-desktop.png), [`app-mobile.png`](evidence/app-mobile.png) (responsive layout), [`ingress-app.png`](evidence/ingress-app.png), and the demo video |

API: `GET/POST /api/products`, `GET/PUT/DELETE /api/products/{id}`, `GET /api/products/stats`, plus `/health`, `/ready`, `/metrics`.

## M2 Testing (10)

| What to submit | Where |
|---|---|
| `backend/tests/` | [`test_api.py`](../backend/tests/test_api.py): 11 tests covering every endpoint, including 404, 409 and 422 cases |
| `pytest.ini` / `conftest.py` | [`pytest.ini`](../backend/pytest.ini), [`conftest.py`](../backend/tests/conftest.py) (in-memory SQLite test DB, never the real PostgreSQL) |
| `pytest -v` screenshot, all passing | [`pytest.png`](evidence/pytest.png) (11 passed) |

## M3 Git and GitHub (5)

| What to submit | Where |
|---|---|
| Repository URL | https://github.com/tirth-alt/stockflow-devops (public) |
| Commit history screenshot, ≥ 10 commits | [`git-log.png`](evidence/git-log.png) (all commits, meaningful messages), [`commits.png`](evidence/commits.png) (GitHub) |
| `.gitignore` covers `.env`, `__pycache__`, `node_modules`, `.venv` | [`.gitignore`](../.gitignore) |

## M4 Docker (10)

| What to submit | Where |
|---|---|
| `backend/Dockerfile` | [`backend/Dockerfile`](../backend/Dockerfile) (runs as UID 10001) |
| `frontend/Dockerfile` (multi-stage Node → Nginx) | [`frontend/Dockerfile`](../frontend/Dockerfile) (Nginx unprivileged, UID 101) |
| `docker-compose.yml` | [`docker-compose.yml`](../docker-compose.yml) |
| `docker compose up --build` screenshot | [`compose-up.png`](evidence/compose-up.png), [`compose-ps-nonroot.png`](evidence/compose-ps-nonroot.png) (3 services up, `id` shows non-root users) |
| Browser at `http://localhost:3000` | [`app-desktop.png`](evidence/app-desktop.png) |

## M5 CI/CD (15)

| What to submit | Where |
|---|---|
| `.github/workflows/` | [`ci-cd.yml`](../.github/workflows/ci-cd.yml): push to `main` → `test` (pytest + frontend build) → `build-scan-push` (Docker, Trivy, GHCR) → `deploy` (Helm) |
| Green pipeline run URL | {{RUN_URL}} (demo run). Earlier green run: https://github.com/tirth-alt/stockflow-devops/actions/runs/38940817089, screenshot [`ci-green.png`](evidence/ci-green.png) |
| GHCR screenshot with SHA tags | [`ghcr.png`](evidence/ghcr.png): `ghcr.io/tirth-alt/stockflow-backend:<commit-sha>`, no `latest` |

## M6 DevSecOps (5)

| What to submit | Where |
|---|---|
| Trivy step in the workflow | [`ci-cd.yml`](../.github/workflows/ci-cd.yml) steps "Trivy scan - backend/frontend" (`severity: HIGH,CRITICAL`, `exit-code: "1"`) |
| Trivy output from a pipeline run | [`trivy-ci.png`](evidence/trivy-ci.png) (pipeline log: 0 vulnerabilities in both images) |
| 2–3 sentence explanation | Below |

**What Trivy scanned and what the result means.** In every pipeline run, Trivy scans both images: the OS packages (Debian in the backend, Alpine in the frontend) and every Python library, and it fails the build on any HIGH or CRITICAL CVE that already has a fix. Before the first push, the frontend failed this gate: the old `nginx-unprivileged:1.29-alpine` base contained a vulnerable `pcre2` (e.g. CVE-2026-86145, an out-of-bounds write that can lead to code execution through a crafted regex) and `libtiff`. Moving to `1.30-alpine` brought in the patched packages, so both images now scan clean. A clean scan means "no *known*, *fixable* HIGH/CRITICAL CVEs today". It does not cover bugs in our own code (SAST), leaked secrets or future CVEs.

## M7 Terraform (15)

| What to submit | Where |
|---|---|
| `terraform/` `.tf` files | [`terraform/`](../terraform/): `versions.tf`, `variables.tf`, `main.tf`, `outputs.tf`, [`terraform.tfvars.example`](../terraform/terraform.tfvars.example) |
| `terraform plan` screenshot | [`terraform-plan.png`](evidence/terraform-plan.png) ("Plan: 55 to add"), full output [`terraform-plan.txt`](evidence/terraform-plan.txt) |
| AWS Console: VPC + EKS in the region | [`aws_vpc.png`](evidence/aws_vpc.png), [`aws_vpc_subnett.png`](evidence/aws_vpc_subnett.png), [`aws_eks.png`](evidence/aws_eks.png), [`aws_eks_nodegroup.png`](evidence/aws_eks_nodegroup.png) (ap-south-1 Mumbai), CLI and `kubectl get nodes` proof in [`aws-eks-verification.txt`](evidence/aws-eks-verification.txt) |
| `terraform destroy` completion screenshot | [`terraform-destroy.png`](evidence/terraform-destroy.png), full output [`terraform-destroy.txt`](evidence/terraform-destroy.txt), and the "nothing left" check in [`aws-after-destroy.png`](evidence/aws-after-destroy.png) |

Apply logs: [`terraform-apply.txt`](evidence/terraform-apply.txt) (first attempt: the node group failed because `t3.medium` is not allowed on an AWS Free-plan account) and [`terraform-apply-nodegroup.txt`](evidence/terraform-apply-nodegroup.txt) (fixed with `c7i-flex.large`). No credentials are in the repo: keys live only in `~/.aws`, and `trivy fs --scanners secret` is clean.

## M8 Kubernetes + Helm (15)

| What to submit | Where |
|---|---|
| `k8s/` | [`k8s/namespace.yaml`](../k8s/namespace.yaml) |
| `helm/` chart | [`helm/stockflow/`](../helm/stockflow/): `Chart.yaml`, `values.yaml`, `values-dev.yaml`, `values-prod.yaml`, templates for deployments, ClusterIP services, Ingress, HPA, PostgreSQL + PVC, ServiceMonitor, Grafana dashboard |
| `kubectl get pods` (all Running) | [`k8s-pods-svc.png`](evidence/k8s-pods-svc.png) |
| `kubectl get svc` | [`k8s-pods-svc.png`](evidence/k8s-pods-svc.png) |
| `helm list` | [`helm-ingress-hpa.png`](evidence/helm-ingress-hpa.png) (release `deployed`, backend and frontend 2/2 replicas, Ingress, HPA) |
| App through the Ingress hostname | [`ingress-app.png`](evidence/ingress-app.png) (`stockflow.local`, served by the nginx Ingress controller), [`ingress-api.png`](evidence/ingress-api.png) (`/api` routed to the backend) |

Autoscaling: [`hpa-scaling.png`](evidence/hpa-scaling.png). Under `scripts/load-test.sh`, CPU rose 11% → 457% of the 60% target and the HPA scaled the backend 2 → 4 → 6 pods.

## M9 Observability (10)

| What to submit | Where |
|---|---|
| `monitoring/` values | [`monitoring/kube-prometheus-stack-values.yaml`](../monitoring/kube-prometheus-stack-values.yaml) (Prometheus + Grafana) |
| `curl /metrics` output | [`metrics.png`](evidence/metrics.png) |
| Prometheus Targets page, app `UP` | [`prometheus-targets.png`](evidence/prometheus-targets.png) (`serviceMonitor/stockflow/stockflow-backend`, 2/2 up) |
| Grafana dashboard with a populated panel | [`grafana-dashboard.png`](evidence/grafana-dashboard.png) ("StockFlow API": requests/s, p95 latency, 5xx rate, pods, CPU during a load test) |

## M10 Presentation + documentation (5)

| What to submit | Where |
|---|---|
| Root `README.md` | [`README.md`](../README.md): what the app does, architecture, how to run every part |
| Live demo or recorded walkthrough | [`docs/demo/stockflow-demo.mp4`](demo/stockflow-demo.mp4): change the header, commit, push, watch the pipeline (sped up), see the new image SHA rolled out by Helm and live through the Ingress. Run: {{RUN_URL}}. Full live-presentation script: [`docs/DEMO.md`](DEMO.md) |

Troubleshooting lab (README Part N): [`troubleshooting/`](../troubleshooting/), recorded run [`troubleshooting-run.txt`](evidence/troubleshooting-run.txt).

## Grading checklist (from GRADING.md)

- [x] GitHub repository URL
- [x] Application runs via `docker compose up --build`
- [x] At least 4 REST API endpoints
- [x] Alembic migration file present
- [x] pytest passes (screenshot)
- [x] At least 5 test cases (11)
- [x] `backend/Dockerfile` builds
- [x] `frontend/Dockerfile` uses a multi-stage build
- [x] Non-root user in both Dockerfiles
- [x] GitHub Actions workflow present, runs on push to `main`, pytest in the pipeline
- [x] Images pushed to GHCR with SHA tags
- [x] Trivy scan in the pipeline
- [x] No secrets committed to Git
- [x] `terraform plan` output submitted
- [x] VPC + EKS provisioned (AWS Console screenshots)
- [x] `terraform destroy` output submitted
- [x] `kubectl get pods` screenshot (all Running)
- [x] `helm list` screenshot
- [x] Application accessible via Ingress
- [x] `/metrics` endpoint screenshot
- [x] Prometheus Targets page screenshot (UP)
- [x] Grafana dashboard screenshot
- [x] README.md present
- [x] Recorded walkthrough
