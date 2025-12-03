#!/bin/bash

# Quick deploy script for marketing website only
# Use this when you only changed marketing website code

set -e

AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REGISTRY=${ECR_REGISTRY:-223882168768.dkr.ecr.us-east-1.amazonaws.com}
CLUSTER_NAME="faxi-qa-cluster"
SERVICE_NAME="faxi-qa-marketing"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

echo "🚀 Quick deploy: Marketing Website only"
echo "Timestamp: $TIMESTAMP"

# Login to ECR
echo "📦 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

# Build marketing website
echo "🔨 Building marketing website..."
cd marketing-website
docker build --platform linux/amd64 --no-cache \
  --build-arg NEXT_PUBLIC_API_URL=http://qa-fax.faxi.jp \
  -t faxi-marketing-website:qa \
  -f Dockerfile .
cd ..

# Tag and push
echo "📤 Pushing to ECR..."
docker tag faxi-marketing-website:qa $ECR_REGISTRY/faxi-marketing-website:qa
docker tag faxi-marketing-website:qa $ECR_REGISTRY/faxi-marketing-website:qa-$TIMESTAMP
docker push $ECR_REGISTRY/faxi-marketing-website:qa
docker push $ECR_REGISTRY/faxi-marketing-website:qa-$TIMESTAMP

# Force new deployment
echo "🔄 Forcing new deployment..."
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --force-new-deployment \
  --region $AWS_REGION

echo "✅ Marketing website deployment initiated!"
echo "Monitor: aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION"
