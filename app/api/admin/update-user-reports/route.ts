import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting daily user reports update...');
    
    // Get all affiliate referrers (users)
    const { data: referrers, error: referrersError } = await supabase
      .from('affiliate_referrers')
      .select('user_id');
    
    if (referrersError) {
      console.error('Error fetching referrers:', referrersError);
      return NextResponse.json({ error: 'Failed to fetch referrers' }, { status: 500 });
    }
    
    console.log(`📊 Processing ${referrers.length} users...`);
    
    const today = new Date();
    // Convert to MDT timezone
    const mdtToday = new Date(today.toLocaleString("en-US", {timeZone: "America/Denver"}));
    mdtToday.setHours(0, 0, 0, 0);
    
    for (const referrer of referrers) {
      try {
        console.log(`👤 Processing user ${referrer.user_id}`);
        
        // Get current user_reports
        const { data: kpiData, error: kpiError } = await supabase
          .from('dashboard_kpis')
          .select('user_reports')
          .eq('user_id', referrer.user_id)
          .single();
        
        if (kpiError && kpiError.code !== 'PGRST116') {
          console.error(`Error fetching KPIs for user ${referrer.user_id}:`, kpiError);
          continue;
        }
        
        let userReports = kpiData?.user_reports || {
          links: {},
          sub_ids: {},
          overview: {},
          traffic_sources: {}
        };
        
        // Ensure overview exists
        if (!userReports.overview) {
          userReports.overview = {};
        }
        
        // Add today's entry if it doesn't exist
        const todayKey = mdtToday.toLocaleDateString("en-CA", {timeZone: "America/Denver"}); // YYYY-MM-DD format
        
        if (!userReports.overview[todayKey]) {
          userReports.overview[todayKey] = {
            clicks: 0,
            signups: 0,
            earnings: 0,
            customers: 0
          };
          console.log(`📅 Added today's entry (${todayKey}) for user ${referrer.user_id}`);
          
          // Update the database
          const { error: updateError } = await supabase
            .from('dashboard_kpis')
            .upsert({
              user_id: referrer.user_id,
              user_reports: userReports,
              updated_at: new Date().toISOString()
            });
          
          if (updateError) {
            console.error(`Error updating reports for user ${referrer.user_id}:`, updateError);
          } else {
            console.log(`✅ Updated reports for user ${referrer.user_id}`);
          }
        }
        
      } catch (error) {
        console.error(`Error processing user ${referrer.user_id}:`, error);
      }
    }
    
    console.log('✅ Daily user reports update completed');
    return NextResponse.json({ success: true, message: 'User reports updated successfully' });
    
  } catch (error) {
    console.error('Error in daily user reports update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 