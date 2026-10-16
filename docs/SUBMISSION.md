# Submission checklist: StockFlow (Session 21 capstone)

Repository: https://github.com/tirth-alt/stockflow-devops (public)
Domain: inventory management (own domain, not the TaskBoard reference)

Evidence lives in `docs/evidence/`. ✅ = verified, with evidence in the repo. 📸 = verified, but the screenshot must be taken by you while running it. ⏳ = still to do.

## M1 Application (10)

| Criterion | Where | Status |
|---|---|---|
| FastAPI starts, `/health` responds | `backend/app/main.py` | ✅ `{"status":"UP"}` (Compose and Kubernetes) |
| ≥ 4 REST endpoints (GET/POST/PUT/DELETE) | `/api/products` CRUD + `/stats` | ✅ 6 product endpoints |
| PostgreSQL table managed by Alembic | `backend/alembic/versions/0001_create_products.py` | ✅ `alembic_version = 0001_create_products` |
| Frontend renders and calls the API | `frontend/src/main.jsx` | ✅ `evidence/app-desktop.png` |
| Responsive, usable UI | `frontend/src/styles.css` | ✅ `evidence/app-mobile.png` (390 px) |

## M2 Testing (10)

| Criterion | Where | Status |
|---|---|---|
| `pytest` runs without errors | `backend/` | ✅ `evidence/pytest-output.txt`, 📸 `pytest -v` |
| ≥ 5 tests over ≥ 3 endpoints | `backend/tests/test_api.py` | ✅ 11 tests, all endpoints |
| Test DB, not production | `backend/tests/conftest.py` | ✅ in-memory SQLite via dependency override |
| `pytest.ini` / `conftest.py` | both present | ✅ |

## M3 Git and GitHub (5)

| Criterion | Status |
|---|---|
| Public repo | ✅ |
| Meaningful commit messages | ✅ (`git log --oneline`) |
| `.gitignore` covers `.env`, `__pycache__`, `node_modules`, `.venv` | ✅ |
| Commit-history screenshot showing ≥ 10 commits | 📸 GitHub → Commits |

## M4 Docker (10)

| Criterion | Status |
|---|---|
| `backend/Dockerfile` builds | ✅ |
| Frontend multi-stage (Node build → Nginx runtime) | ✅ `frontend/Dockerfile` |
| Non-root images | ✅ backend `uid=10001`, frontend `uid=101` (`docker compose exec <svc> id`) |
| `docker compose up --build` starts all 3 services | ✅, 📸 terminal + browser at http://localhost:3000 |

## M5 CI/CD (15)

| Criterion | Status |
|---|---|
| Workflow in `.github/workflows/` | ✅ `ci-cd.yml` |
| Triggers on push to `main` | ✅ |
| pytest job fails the build on failure | ✅ `test` job; `build-scan-push` has `needs: test` |
| Frontend built in the pipeline | ✅ `npm ci && npm run build` |
| Images built for frontend and backend | ✅ multi-arch (amd64 + arm64) |
| Pushed to GHCR | ✅ `ghcr.io/tirth-alt/stockflow-{backend,frontend}` |
| Tags are the commit SHA | ✅ `:${{ github.sha }}`; the chart refuses an empty tag |
| Green run URL + GHCR screenshot | 📸 Actions tab → latest run; github.com/tirth-alt?tab=packages |

## M6 DevSecOps (5)

| Criterion | Status |
|---|---|
| Trivy scans both images in CI | ✅ two scan steps |
| Fails on HIGH/CRITICAL | ✅ `severity: HIGH,CRITICAL`, `exit-code: "1"` |
| Explain a CVE / clean result | ✅ below, 📸 a Trivy step log |

**What Trivy scanned and what the result means:**
Trivy scanned every OS package (Debian in the backend image, Alpine in the frontend image) and every Python library in both images against public vulnerability databases. The pipeline fails if it finds a HIGH or CRITICAL CVE that already has a fix (`ignore-unfixed`), because those are the ones we can act on. The first local scan failed the frontend: the old `nginx-unprivileged:1.29-alpine` base shipped vulnerable `pcre2` (e.g. CVE-2026-86145, an out-of-bounds write that could allow code execution through a crafted regex) and `libtiff`. Moving the base image to `1.30-alpine` pulled in the patched packages, and both images now scan clean. A clean result means "no *known*, *fixable* HIGH/CRITICAL CVEs today". It says nothing about bugs in our own code (that's SAST), leaked secrets, or CVEs published tomorrow.

## M7 Terraform (15)

| Criterion | Status |
|---|---|
| Valid HCL in `terraform/` | ✅ `terraform fmt -check` + `terraform validate` pass |
| `terraform init` | ✅ |
| `terraform plan` non-empty, no errors | ⏳ needs your AWS credentials |
| VPC with ≥ 2 public subnets | ✅ in code (2 public + 2 private); ⏳ apply |
| EKS + ≥ 1 node group | ✅ in code (EKS 1.36, managed group `main`); ⏳ apply |
| `terraform destroy` clean | ⏳ |
| `terraform.tfvars.example`, no credentials committed | ✅ (`trivy fs --scanners secret` clean) |
| Screenshots: plan, AWS Console (VPC + EKS in ap-south-1), destroy | ⏳ 📸 |

## M8 Kubernetes + Helm (15)

| Criterion | Status |
|---|---|
| `k8s/namespace.yaml` applies | ✅ |
| Chart with `Chart.yaml`, `values.yaml`, templates | ✅ `helm/stockflow/` (`helm lint` passes) |
| `helm upgrade --install` succeeds | ✅ release `stockflow`, status `deployed` |
| Backend and frontend ≥ 2 replicas | ✅ HPA min 2 for backend; frontend 2 |
| ClusterIP Services | ✅ `stockflow-backend`, `stockflow-frontend`, `stockflow-postgres` |
| Ingress `/` → frontend, `/api` → backend | ✅ verified through the ingress-nginx controller |
| All pods Running | ✅, 📸 `kubectl get pods -n stockflow` |
| Screenshots: pods, svc, `helm list`, app via Ingress | 📸 |

HPA evidence: `evidence/hpa-scaling.txt` (2 → 4 → 5 → 6 replicas under load).

## M9 Observability (10)

| Criterion | Status |
|---|---|
| `/metrics` in Prometheus format | ✅, 📸 `curl localhost:8000/metrics` |
| Prometheus installed and scraping | ✅ `serviceMonitor/stockflow/stockflow-backend` targets `up` |
| Grafana installed and accessible | ✅ |
| Panel with live app metrics | ✅ "StockFlow API" dashboard |
| Screenshots: Targets page (UP), Grafana dashboard | `evidence/prometheus-targets.png`, `evidence/grafana-dashboard.png`, 📸 retake live |

## M10 Presentation + docs (5)

| Criterion | Status |
|---|---|
| Root `README.md` explains the app | ✅ |
| Live demo: commit → pipeline → deployment updates | ✅ verified: [run 38872489128](https://github.com/tirth-alt/stockflow-devops/actions/runs/38872489128) deployed commit `560b7bf` as Helm revision 5 via the self-hosted runner. Rehearse with `docs/DEMO.md` |

## Before you submit

- [ ] AWS: plan → apply → screenshots → **destroy** (see `terraform/README.md`)
- [ ] Take the 📸 screenshots above (put them in `docs/evidence/` or attach them to the form)
- [ ] Rehearse `docs/DEMO.md` once end to end
- [ ] Submit the repo URL in the submission form
