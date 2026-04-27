-- Migration 002: Add email column to sewers table
-- Run this in Supabase SQL Editor

ALTER TABLE sewers ADD COLUMN IF NOT EXISTS email TEXT;
