#!/bin/bash
# Opens an SSM tunnel to the Production database
# DBeaver connection: localhost:5434, database: faxi_prod, user: faxi_prod_user

TASK_ID=$(aws ecs list-tasks --cluster faxi-prod-cluster --service-name faxi-prod-backend --query 'taskArns[0]' --output text --region us-east-1 | awk -F'/' '{print $3}')
RUNTIME_ID=$(aws ecs describe-tasks --cluster faxi-prod-cluster --tasks $TASK_ID --region us-east-1 --query 'tasks[0].containers[0].runtimeId' --output text)

echo "Starting Production database tunnel on localhost:5434..."
aws ssm start-session \
  --target ecs:faxi-prod-cluster_${TASK_ID}_${RUNTIME_ID} \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["prod-faxi-db.cazismkei51t.us-east-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5434"]}' \
  --region us-east-1
