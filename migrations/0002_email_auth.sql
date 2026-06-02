-- Email/password authentication
-- Migration: 0002_email_auth

ALTER TABLE users ADD COLUMN password_hash TEXT;
