-- VX Affiliate Portal Database Schema
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create affiliate_profiles table
CREATE TABLE IF NOT EXISTS affiliate_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    user_aryeo_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    social_links JSONB DEFAULT '{}',
    notifications JSONB DEFAULT '{
        "email_reports": true,
        "sms_alerts": false,
        "push_notifications": true
    }',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create affiliate_referrers table
CREATE TABLE IF NOT EXISTS affiliate_referrers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create approved_users table
CREATE TABLE IF NOT EXISTS approved_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    user_email TEXT NOT NULL,
    approved_by TEXT,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dashboard_kpis table
CREATE TABLE IF NOT EXISTS dashboard_kpis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    user_reports JSONB DEFAULT '{
        "links": {},
        "sub_ids": {},
        "overview": {},
        "traffic_sources": {}
    }',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create affiliate_assets table
CREATE TABLE IF NOT EXISTS affiliate_assets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    thumb TEXT,
    description TEXT,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create referral_events table
CREATE TABLE IF NOT EXISTS referral_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent TEXT NOT NULL,
    email TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT DEFAULT 'pending',
    referrer_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_affiliate_profiles_user_id ON affiliate_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrers_user_id ON affiliate_referrers(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrers_code ON affiliate_referrers(code);
CREATE INDEX IF NOT EXISTS idx_approved_users_user_id ON approved_users(user_id);
CREATE INDEX IF NOT EXISTS idx_approved_users_email ON approved_users(user_email);
CREATE INDEX IF NOT EXISTS idx_dashboard_kpis_user_id ON dashboard_kpis(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer_id ON referral_events(referrer_id);

-- Enable Row Level Security (RLS)
ALTER TABLE affiliate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrers ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for affiliate_profiles
CREATE POLICY "Users can view their own profile" ON affiliate_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON affiliate_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON affiliate_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for affiliate_referrers
CREATE POLICY "Users can view their own referral code" ON affiliate_referrers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own referral code" ON affiliate_referrers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for approved_users
CREATE POLICY "Users can view their own approval status" ON approved_users
    FOR SELECT USING (auth.uid() = user_id);

-- Create RLS policies for dashboard_kpis
CREATE POLICY "Users can view their own KPIs" ON dashboard_kpis
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own KPIs" ON dashboard_kpis
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own KPIs" ON dashboard_kpis
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for affiliate_assets (read-only for all users)
CREATE POLICY "All users can view assets" ON affiliate_assets
    FOR SELECT USING (true);

-- Create RLS policies for referral_events
CREATE POLICY "Users can view their own referral events" ON referral_events
    FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "Users can insert their own referral events" ON referral_events
    FOR INSERT WITH CHECK (auth.uid() = referrer_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_affiliate_profiles_updated_at BEFORE UPDATE ON affiliate_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliate_referrers_updated_at BEFORE UPDATE ON affiliate_referrers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approved_users_updated_at BEFORE UPDATE ON approved_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_kpis_updated_at BEFORE UPDATE ON dashboard_kpis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliate_assets_updated_at BEFORE UPDATE ON affiliate_assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referral_events_updated_at BEFORE UPDATE ON referral_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 