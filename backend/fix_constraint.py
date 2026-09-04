from app.db import engine
from sqlalchemy import text
from app.synthetic.demo_persona import reset_demo_persona

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE identity.user_roles DROP CONSTRAINT IF EXISTS ck_user_roles_role_valid;"))
    conn.execute(text("ALTER TABLE identity.user_roles ADD CONSTRAINT ck_user_roles_role_valid CHECK (role IN ('personnel', 'welfare_officer', 'commander', 'admin'));"))
    conn.commit()

print("Constraint updated successfully.")
res = reset_demo_persona()
print("Reset demo persona result:", res)
