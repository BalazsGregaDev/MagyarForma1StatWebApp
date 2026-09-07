URL=https://wssaqerzjstxhhngbgte.supabase.co/functions/v1/sync-f1
KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzc2FxZXJ6anN0eGhobmdiZ3RlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzcwMDg5OCwiZXhwIjoyMTAzMjc2ODk4fQ.wBbgdrR_43A1QPhWmkwi99T-wxAYo72rfYcbwu7BTNE


curl -X POST "$URL" -H "Authorization: Bearer $KEY" \
     -H "Content-Type: application/json" \
     -d '{"task":"historical","season":1950}'