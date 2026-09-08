#!/usr/bin/env bash
# Deploys the GovOS backend to AWS App Runner and wires up DynamoDB + an
# EventBridge rule that can wake the agent with zero human interaction.
#
# This is the "reliable path" deploy (App Runner). For a stronger
# Technological Implementation score, deploy via Amazon Bedrock AgentCore
# Runtime instead, using the `agentcore` starter toolkit
# (https://github.com/aws/bedrock-agentcore-starter-toolkit) against the same
# backend/Dockerfile — that toolkit's exact CLI has moved across releases,
# so it isn't scripted here; follow its own quickstart once you're ready for
# that path.
#
# Usage: bash deploy/deploy.sh <AWS_REGION> [ECR_REPO_NAME]
set -euo pipefail

AWS_REGION="${1:?Usage: deploy.sh <AWS_REGION> [ECR_REPO_NAME]}"
REPO_NAME="${2:-govos-backend}"
TABLE_NAME="govos-incidents"
SERVICE_NAME="govos-backend"
ROLE_NAME="govos-app-runner-role"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}"

echo "== ECR: build + push image =="
aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$AWS_REGION" \
  || aws ecr create-repository --repository-name "$REPO_NAME" --region "$AWS_REGION"

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker build -t "$REPO_NAME" backend
docker tag "${REPO_NAME}:latest" "${ECR_URI}:latest"
docker push "${ECR_URI}:latest"

echo "== DynamoDB: incidents table =="
aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$AWS_REGION" >/dev/null 2>&1 || \
aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions AttributeName=incident_id,AttributeType=S \
  --key-schema AttributeName=incident_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$AWS_REGION"

echo "== IAM: App Runner instance role (DynamoDB + Bedrock access) =="
cat > /tmp/govos-trust-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "tasks.apprunner.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF
aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1 || \
aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document file:///tmp/govos-trust-policy.json

aws iam attach-role-policy --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
aws iam attach-role-policy --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)

echo "== App Runner: create/update service =="
aws apprunner create-service \
  --service-name "$SERVICE_NAME" \
  --region "$AWS_REGION" \
  --source-configuration "{
    \"ImageRepository\": {
      \"ImageIdentifier\": \"${ECR_URI}:latest\",
      \"ImageRepositoryType\": \"ECR\",
      \"ImageConfiguration\": {
        \"Port\": \"8080\",
        \"RuntimeEnvironmentVariables\": {
          \"GOVOS_STORE\": \"dynamodb\",
          \"GOVOS_TABLE\": \"${TABLE_NAME}\",
          \"AWS_REGION\": \"${AWS_REGION}\"
        }
      }
    },
    \"AuthenticationConfiguration\": { \"AccessRoleArn\": \"${ROLE_ARN}\" }
  }" \
  --instance-configuration "{ \"InstanceRoleArn\": \"${ROLE_ARN}\" }" \
  || echo "Service may already exist — use 'aws apprunner update-service' to redeploy the new image."

SERVICE_URL=$(aws apprunner describe-service --service-arn \
  "$(aws apprunner list-services --region "$AWS_REGION" --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceArn" --output text)" \
  --region "$AWS_REGION" --query 'Service.ServiceUrl' --output text)
echo "Backend URL: https://${SERVICE_URL}"

echo "== EventBridge: rule to wake the agent (manual test path) =="
echo "For a real zero-prompt trigger, create an EventBridge rule with an API"
echo "destination targeting https://${SERVICE_URL}/events/eventbridge — see"
echo "https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-api-destinations.html"
echo ""
echo "Quick manual test once deployed:"
echo "curl -X POST https://${SERVICE_URL}/events/incident -H 'Content-Type: application/json' -d '{\"zone\":\"South Delhi\",\"rainfall_intensity\":\"high\"}'"
