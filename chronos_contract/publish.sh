#!/bin/bash

# Ensure we are using the testnet environment
sui client switch --env quirpc

# Publish the package
echo "Publishing Chronos contract to Testnet..."
OUTPUT=$(sui client publish --gas-budget 100000000 --skip-dependency-verification --json)

if [ $? -eq 0 ]; then
  echo "Publish successful!"
  
  # Extract Package ID
  PACKAGE_ID=$(echo $OUTPUT | jq -r '.objectChanges[] | select(.type == "published") | .packageId')
  
  echo "Package ID: $PACKAGE_ID"
  
  # Save to a file for frontend to use
  echo "export const PACKAGE_ID = '$PACKAGE_ID';" > ../chronos_frontend/src/constants.ts
  echo "Package ID saved to ../chronos_frontend/src/constants.ts"
else
  echo "Publish failed."
  echo $OUTPUT
fi
