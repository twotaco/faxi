Note that the task IDs change on each deployment,

  Usage:
  ./scripts/qa-db-tunnel.sh    # Then connect DBeaver to localhost:5433
  ./scripts/prod-db-tunnel.sh  # Then connect DBeaver to localhost:5434

the default postgres database first to see if the
  tunnel works:

  | Field    | Value                     |
  |----------|---------------------------|
  | Host     | localhost                 |
  | Port     | 5433                      |
  | Database | postgres                  |
  | Username | faxi_qa_user              |
  | Password | FaxiQA2024SecurePassword! |



Here are the scripts:

  QA Tunnel (saved as qa-db-tunnel.sh):
  #!/bin/bash
  TASK_ID=$(aws ecs list-tasks --cluster faxi-qa-cluster --service-name faxi-qa-backend --query
  'taskArns[0]' --output text --region us-east-1 | awk -F'/' '{print $3}')
  RUNTIME_ID=$(aws ecs describe-tasks --cluster faxi-qa-cluster --tasks $TASK_ID --region
  us-east-1 --query 'tasks[0].containers[0].runtimeId' --output text)
  aws ssm start-session --target ecs:faxi-qa-cluster_${TASK_ID}_${RUNTIME_ID} --document-name
  AWS-StartPortForwardingSessionToRemoteHost --parameters '{"host":["qa-faxi-db.cazismkei51t.us-e
  ast-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5433"]}' --region us-east-1

  Prod Tunnel (saved as prod-db-tunnel.sh):
  #!/bin/bash
  TASK_ID=$(aws ecs list-tasks --cluster faxi-prod-cluster --service-name faxi-prod-backend
  --query 'taskArns[0]' --output text --region us-east-1 | awk -F'/' '{print $3}')
  RUNTIME_ID=$(aws ecs describe-tasks --cluster faxi-prod-cluster --tasks $TASK_ID --region
  us-east-1 --query 'tasks[0].containers[0].runtimeId' --output text)
  aws ssm start-session --target ecs:faxi-prod-cluster_${TASK_ID}_${RUNTIME_ID} --document-name
  AWS-StartPortForwardingSessionToRemoteHost --parameters '{"host":["prod-faxi-db.cazismkei51t.us
  -east-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5434"]}' --region
  us-east-1