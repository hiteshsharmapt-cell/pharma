"""People who left their details: the website pop-up form, or a Tawk.to live chat / ticket (via webhook)."""
from datetime import datetime
from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class Contact(Base):
    __tablename__ = "contacts"
    __table_args__ = (Index("ix_contacts_created", "created_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20), index=True)   # NULL for chats where no number was given
    email: Mapped[str | None] = mapped_column(String(255))
    requirement: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="popup", index=True)  # popup | chat | ticket
    page: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
