#!/bin/bash

# Monitor QA CloudFormation Stack Creation

echo "🔍 Monitoring faxi-qa-infrastructure stack..."
echo ""

while true; do
    STATUS=$(aws cloudformation describe-stacks \
        --stack-name faxi-qa-infrastructure \
        --region us-east-1 \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        echo "❌ Stack not found or error occurred"
        exit 1
    fi
    
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $STATUS in
        "CREATE_IN_PROGRESS")
            echo "[$TIMESTAMP] ⏳ Status: $STATUS"
            ;;
        "CREATE_COMPLETE")
            echo "[$TIMESTAMP] ✅ Status: $STATUS"
            echo ""
            echo "🎉 Stack creation complete!"
            echo ""
            echo "📊 Getting outputs..."
            aws cloudformation describe-stacks \
                --stack-name faxi-qa-infrastructure \
                --region us-east-1 \
                --query 'Stacks[0].Outputs' \
                --output table
            exit 0
            ;;
        "CREATE_FAILED"|"ROLLBACK_IN_PROGRESS"|"ROLLBACK_COMPLETE")
            echo "[$TIMESTAMP] ❌ Status: $STATUS"
            echo ""
            echo "Failed resources:"
            aws cloudformation describe-stack-events \
                --stack-name faxi-qa-infrastructure \
                --region us-east-1 \
                --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].[ResourceType,ResourceStatusReason]' \
                --output table
            exit 1
            ;;
        *)
            echo "[$TIMESTAMP] Status: $STATUS"
            ;;
    esac
    
    sleep 30
done
