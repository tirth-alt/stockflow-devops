# Terraform: AWS VPC + EKS

Creates the AWS infrastructure for StockFlow in `ap-south-1`:

```text
VPC 10.20.0.0/16
 ├── 2 public subnets   (load balancers, NAT gateway)
 ├── 2 private subnets  (worker nodes)
 ├── Internet gateway + 1 NAT gateway
 └── EKS cluster (Kubernetes 1.36)
       └── managed node group "main" (2 × t3.medium)
```

## Cost warning

EKS control plane (~$0.10/h) + NAT gateway (~$0.05/h) + 2 × t3.medium (~$0.09/h) ≈ **$0.25/hour**.
Run `terraform destroy` as soon as you have your screenshots.

Keep `kubernetes_version` in EKS *standard* support. A version in extended support bills the
control plane at $0.60/h instead of $0.10/h.

## Run it

```bash
aws configure                     # your own keys, stored in ~/.aws, never in this repo
aws sts get-caller-identity       # confirm which account you are about to spend in

cd terraform
cp terraform.tfvars.example terraform.tfvars   # optional overrides
terraform init
terraform fmt -check
terraform validate
terraform plan -out tfplan
terraform apply tfplan            # ~15 minutes

$(terraform output -raw configure_kubectl)     # point kubectl at the cluster
kubectl get nodes

terraform destroy                 # ~10 minutes; confirm with "yes"
```

State is kept locally (`terraform.tfstate`, git-ignored). A team would use an S3 backend with locking.
