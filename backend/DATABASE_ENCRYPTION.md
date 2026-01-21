# FEDERAL COMPLIANCE: Database Encryption Strategy

## Current State
- MongoDB encryption in transit (TLS)
- No encryption at rest
- No field-level encryption

## Solution: MongoDB Enterprise Encryption

### 1. Encryption at Rest

**Enable in MongoDB configuration:**
```yaml
security:
  enableEncryption: true
  encryptionKeyFile: /path/to/keyfile
```

**Using AWS KMS (Recommended for Federal):**
```yaml
security:
  enableEncryption: true
  kmip:
    serverName: kms.us-east-1.amazonaws.com
    port: 5696
    clientCertificateFile: /path/to/client.pem
```

### 2. Field-Level Encryption (FLE)

For sensitive fields (SSN, credit cards, etc.):

```python
from pymongo.encryption import ClientEncryption
from pymongo.encryption_options import AutoEncryptionOpts

# Create encryption client
kms_providers = {
    "aws": {
        "accessKeyId": os.environ['AWS_ACCESS_KEY_ID'],
        "secretAccessKey": os.environ['AWS_SECRET_ACCESS_KEY']
    }
}

auto_encryption_opts = AutoEncryptionOpts(
    kms_providers,
    "encryption.__keyVault"
)

client = MongoClient(
    mongo_url,
    auto_encryption_opts=auto_encryption_opts
)
```

### 3. FIPS 140-2 Compliance

**Use FIPS-compliant MongoDB:**
```bash
# Download FIPS-compliant MongoDB binary
wget https://downloads.mongodb.com/linux/mongodb-linux-x86_64-enterprise-ubuntu2004-fips-7.0.0.tgz
```

**Enable FIPS mode:**
```yaml
net:
  tls:
    FIPSMode: true
```

### 4. Audit Logging

**Enable MongoDB audit logging:**
```yaml
auditLog:
  destination: file
  format: JSON
  path: /var/log/mongodb/audit.json
  filter: '{"atype": {"$in": ["authenticate", "authCheck", "createUser", "dropUser"]}}'
```

## Implementation Checklist

- [ ] Enable encryption at rest with KMS
- [ ] Implement field-level encryption for PII
- [ ] Enable FIPS mode for federal compliance
- [ ] Configure audit logging
- [ ] Set up key rotation schedule
- [ ] Document encryption keys in runbook
- [ ] Test backup/restore with encryption
- [ ] Verify FIPS compliance with security scan

## Cost Estimate

### MongoDB Atlas (Recommended)
- M10 cluster: $57/month
- Encryption at rest: Included
- FIPS compliance: Enterprise tier ($0.08/hour = ~$60/month)
- **Total: ~$120/month**

### Self-Hosted MongoDB Enterprise
- License: $6,500/year (~$540/month)
- Infrastructure: $100-200/month
- **Total: ~$640-740/month**

**Recommendation:** Use MongoDB Atlas with Enterprise tier for federal deployment.