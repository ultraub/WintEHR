# SSH Commands to Fix Provider List Issue

## 1. SSH into the server
```bash
ssh -i ../../../Downloads/emr-key.pem ec2-user@3.217.74.23
```

## 2. Navigate to the EMR directory
```bash
cd EMR
```

## 3. Quick Fix - Run this first:
```bash
# Create providers in the Docker container
sudo docker exec emr-backend python scripts/create_sample_providers.py

# Wait a moment
sleep 3

# Test the endpoint
curl -s http://localhost:8000/api/auth/providers | python3 -m json.tool | head -20
```

## 4. If that doesn't work, run the troubleshooting script:
```bash
# Download and run the troubleshooting script
curl -O https://raw.githubusercontent.com/your-repo/EMR/master/troubleshoot-providers.sh
chmod +x troubleshoot-providers.sh
./troubleshoot-providers.sh
```

## 5. Alternative manual steps:

### Check if backend is running:
```bash
sudo docker ps
curl http://localhost:8000/health
```

### Check backend logs:
```bash
sudo docker logs emr-backend --tail 50
```

### Access the Docker container:
```bash
sudo docker exec -it emr-backend bash

# Inside the container:
cd /app
python scripts/create_sample_providers.py

# Test directly inside container
python -c "
from database.database import SessionLocal
from models.synthea_models import Provider
db = SessionLocal()
providers = db.query(Provider).all()
print(f'Found {len(providers)} providers')
for p in providers[:3]:
    print(f'  - {p.first_name} {p.last_name} ({p.specialty})')
"

# Exit container
exit
```

### Restart the backend if needed:
```bash
sudo docker restart emr-backend
```

### Check nginx is properly routing:
```bash
# Test backend directly
curl -I http://localhost:8000/api/auth/providers

# Test through nginx
curl -I http://localhost/api/auth/providers

# Check nginx error log
sudo tail -f /var/log/nginx/error.log
```

## 6. Check from browser console:
1. Open the site: http://3.217.74.23/
2. Open browser developer tools (F12)
3. Go to Network tab
4. Refresh the page
5. Look for the request to `/api/auth/providers`
6. Check the response and any errors

## 7. If all else fails, recreate everything:
```bash
# Stop container
sudo docker stop emr-backend

# Remove container
sudo docker rm emr-backend

# Rebuild and start
sudo docker run -d \
  --name emr-backend \
  -p 8000:8000 \
  -v $(pwd)/backend:/app \
  -w /app \
  python:3.9-slim \
  bash -c "
    apt-get update && apt-get install -y curl &&
    pip install -r requirements.txt &&
    python scripts/create_sample_providers.py &&
    python scripts/populate_clinical_catalogs.py &&
    python main.py
  "

# Check logs
sudo docker logs -f emr-backend
```

## Expected output after fix:
When you run `curl -s http://localhost:8000/api/auth/providers | python3 -m json.tool`, you should see:
```json
[
    {
        "id": "...",
        "synthea_id": null,
        "npi": "1234560000",
        "display_name": "John Smith",
        "full_name": "John Smith",
        "specialty": "Family Medicine",
        "first_name": "John",
        "last_name": "Smith"
    },
    ...
]
```

## Common Issues:
1. **Empty provider list**: Run `create_sample_providers.py`
2. **500 error**: Check backend logs for database errors
3. **CORS error**: Frontend API URL mismatch
4. **404 error**: Nginx routing issue