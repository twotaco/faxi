# GitHub Actions Setup for QA Deployment

## Quick Setup (5 minutes)

### 1. Add AWS Credentials to GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret

Add these two secrets:

- **Name**: `AWS_ACCESS_KEY_ID`
  - **Value**: Your AWS access key (from IAM user with ECR/ECS permissions)

- **Name**: `AWS_SECRET_ACCESS_KEY`
  - **Value**: Your AWS secret key

### 2. Create IAM User (if you don't have one)

```bash
# Create IAM user for GitHub Actions
aws iam create-user --user-name github-actions-faxi-qa

# Attach policies
aws iam attach-user-policy \
  --user-name github-actions-faxi-qa \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

aws iam attach-user-policy \
  --user-name github-actions-faxi-qa \
  --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess

# Create access key
aws iam create-access-key --user-name github-actions-faxi-qa
```

Copy the `AccessKeyId` and `SecretAccessKey` from the output.

### 3. Test the Workflow

**Option A: Push to main**
```bash
git add .github/workflows/deploy-qa.yml
git commit -m "Add GitHub Actions deployment"
git push origin main
```

**Option B: Manual trigger**
- Go to GitHub → Actions → "Deploy to QA" → Run workflow

### 4. Monitor the Build

- Go to GitHub → Actions tab
- Click on the running workflow
- Watch the build progress in real-time
- Build should complete in ~8-10 minutes (vs 30 minutes locally)

## Benefits

✅ **Faster builds**: Parallel builds on GitHub's infrastructure  
✅ **No laptop required**: Push and go  
✅ **Build caching**: Subsequent builds are even faster  
✅ **Visibility**: See build logs in GitHub UI  
✅ **Automatic**: Deploys on every push to main  
✅ **Manual option**: Can trigger manually from GitHub UI  

## Workflow Features

- **Parallel builds**: All 3 services build simultaneously
- **Docker layer caching**: Reuses layers from previous builds
- **Automatic deployment**: Updates ECS services after successful build
- **Health checks**: Waits for services to stabilize
- **Status reporting**: Shows deployment status at the end

## Troubleshooting

**Build fails with "unauthorized"**
- Check AWS credentials in GitHub secrets
- Verify IAM user has ECR/ECS permissions

**Deployment succeeds but services don't update**
- Check ECS task definition has correct image tags
- Verify ECS services exist and are running

**Build is slow**
- First build is always slower (no cache)
- Subsequent builds should be 5-10 minutes

## Next Steps

Once this works, you can add:
- Run tests before deployment
- Deploy to production on tags
- Slack notifications on success/failure
- Preview environments for PRs
