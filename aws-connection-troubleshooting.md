# AWS Server Connection Troubleshooting

## Current Issue
Unable to connect to AWS server at `172.31.80.189` via SSH.

## Troubleshooting Steps

### 1. Check AWS Console
**Verify in AWS EC2 Console:**
- ✅ Instance is running (not stopped/terminated)
- ✅ Instance has the correct IP address (172.31.80.189)
- ✅ Instance is in a healthy state

### 2. Security Group Configuration
**Required inbound rules:**
```
Type: SSH
Protocol: TCP
Port: 22
Source: 0.0.0.0/0 (or your specific IP)

Type: HTTP
Protocol: TCP
Port: 3000
Source: 0.0.0.0/0

Type: Custom TCP
Protocol: TCP
Port: 8000
Source: 0.0.0.0/0
```

### 3. Network ACL Settings
**Verify Network ACL allows:**
- Inbound SSH (port 22)
- Outbound HTTP/HTTPS (ports 80, 443)
- Outbound SSH responses (port 22)

### 4. Check Your IP Address
```bash
# Get your current public IP
curl ifconfig.me
```
Make sure this IP is allowed in the Security Group.

### 5. Alternative Connection Methods

#### Option A: Use AWS Session Manager
If you have AWS CLI configured:
```bash
aws ssm start-session --target i-[your-instance-id]
```

#### Option B: EC2 Instance Connect
Use the AWS Console's "Connect" button for browser-based SSH.

#### Option C: Different SSH Options
```bash
# Try with verbose output
ssh -v -i /Users/robertbarrett/dev/emr-key.pem ec2-user@172.31.80.189

# Try with different SSH options
ssh -i /Users/robertbarrett/dev/emr-key.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ec2-user@172.31.80.189
```

### 6. Key File Verification
```bash
# Verify key permissions (should be 600)
ls -la /Users/robertbarrett/dev/emr-key.pem

# Check key format
head -1 /Users/robertbarrett/dev/emr-key.pem
# Should show: -----BEGIN RSA PRIVATE KEY----- or similar
```

## Next Steps

1. **Check AWS Console** - Verify instance status and IP
2. **Update Security Groups** - Ensure SSH access from your IP
3. **Try alternative connection methods** above
4. **Once connected, run the deployment script:**
   ```bash
   ./deploy-to-aws.sh
   ```

## Manual Deployment Steps

If you prefer to deploy manually once connected:

```bash
# 1. Connect to server
ssh -i /Users/robertbarrett/dev/emr-key.pem ec2-user@172.31.80.189

# 2. Install dependencies
sudo yum update -y
sudo yum install -y docker git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# 3. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Clone repository
git clone https://github.com/robertpbarrett/MedGenEMR.git
cd MedGenEMR
git checkout fhir-native-redesign

# 5. Deploy production
./fresh-deploy.sh --mode production --patients 100
```

## Expected Outcome

Once deployment is successful:
- **Frontend**: http://172.31.80.189:3000
- **Backend API**: http://172.31.80.189:8000
- **FHIR Endpoint**: http://172.31.80.189:8000/fhir/R4
- **Admin Login**: demo/password