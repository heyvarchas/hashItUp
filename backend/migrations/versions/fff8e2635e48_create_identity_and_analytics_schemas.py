"""create identity and analytics schemas

Revision ID: fff8e2635e48
Revises: 
Create Date: 2026-09-02 08:07:59.097289

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fff8e2635e48'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Two logical schemas, per the privacy design in the architecture blueprint:
    # identity data (real names/contact info) and analytics data (everything
    # ML/HR/wellness-related, keyed on pseudonymous_id) are kept structurally
    # separate from day one, even though both live in one Postgres instance
    # for the MVP.
    op.execute("CREATE SCHEMA IF NOT EXISTS identity")
    op.execute("CREATE SCHEMA IF NOT EXISTS analytics")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP SCHEMA IF EXISTS analytics CASCADE")
    op.execute("DROP SCHEMA IF EXISTS identity CASCADE")
