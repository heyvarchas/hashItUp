import json
import urllib.request
from app.db import SessionLocal
from app.jwt_auth import create_access_token
from app.models import Personnel

db = SessionLocal()
p = db.query(Personnel).filter(Personnel.service_number == 'CAPF-2024-001').first()
emp_token = create_access_token(str(p.person_id), str(p.pseudonymous_id), 'personnel')

# 1. Post request for leave
payload = {
    'request_type': 'leave',
    'request_details': {'leave_days': 5, 'leave_type': 'Emergency / Casual'},
    'reason': 'Extended operational fatigue and family emergency',
    'additional_note': 'Seeking urgent 5-day leave block'
}
req = urllib.request.Request(
    'http://localhost:8000/requests',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Authorization': f'Bearer {emp_token}', 'Content-Type': 'application/json'}
)
res = urllib.request.urlopen(req)
created = json.loads(res.read().decode())
print('Created request:', created['request_id'], 'Rec:', created['system_recommendation'])

# 2. Get my requests
req_my = urllib.request.Request('http://localhost:8000/requests/my', headers={'Authorization': f'Bearer {emp_token}'})
my_reqs = json.loads(urllib.request.urlopen(req_my).read().decode())
print('My requests count:', len(my_reqs))

# 3. Welfare officer pending
off_token = create_access_token('P0001', 'pseudo-1', 'welfare_officer')
req_pending = urllib.request.Request('http://localhost:8000/requests/pending', headers={'Authorization': f'Bearer {off_token}'})
pending = json.loads(urllib.request.urlopen(req_pending).read().decode())
print('Pending count:', len(pending))

# 4. Officer approves
rid = created['request_id']
req_decide = urllib.request.Request(
    f'http://localhost:8000/requests/{rid}/decision',
    data=json.dumps({'decision': 'APPROVED', 'reason': 'Approved due to high leave gap'}).encode('utf-8'),
    headers={'Authorization': f'Bearer {off_token}', 'Content-Type': 'application/json'}
)
req_decide.get_method = lambda: 'PATCH'
decided = json.loads(urllib.request.urlopen(req_decide).read().decode())
print('Decided status:', decided['status'], 'Officer Reason:', decided['officer_reason'])

# 5. Check employee notifications
req_notif = urllib.request.Request('http://localhost:8000/notifications', headers={'Authorization': f'Bearer {emp_token}'})
notifs = json.loads(urllib.request.urlopen(req_notif).read().decode())
print('Employee notifs count:', len(notifs), 'Latest title:', notifs[0]['title'])
print('Latest msg:', notifs[0]['message'])
