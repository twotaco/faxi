#!/bin/bash
# Opens an SSM tunnel to the QA database
# DBeaver connection: localhost:5433, database: faxi_qa, user: faxi_qa_user

TASK_ID=$(aws ecs list-tasks --cluster faxi-qa-cluster --service-name faxi-qa-backend --query 'taskArns[0]' --output text --region us-east-1 | awk -F'/' '{print $3}')
RUNTIME_ID=$(aws ecs describe-tasks --cluster faxi-qa-cluster --tasks $TASK_ID --region us-east-1 --query 'tasks[0].containers[0].runtimeId' --output text)

echo "Starting QA database tunnel on localhost:5433..."
aws ssm start-session \
  --target ecs:faxi-qa-cluster_${TASK_ID}_${RUNTIME_ID} \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["qa-faxi-db.cazismkei51t.us-east-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5433"]}' \
  --region us-east-1
