'use client';

import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Button, Input, Badge } from '@heroui/react';
import { supabase } from '@/lib/supabase';
import { addToast } from '@heroui/toast';

interface UserRecord {
  id: string;
  user_id: string;
  user_email: string;
  first_name: string;
  last_name: string;
  status: string;
  created_at: string;
  referral_code?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      console.log('Loading approved users...');
      
      // First get approved users
      const { data: approvedUsers, error: approvedError } = await supabase
        .from('approved_users')
        .select('id, user_id, user_email, status, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      console.log('Approved users query result:', { data: approvedUsers, error: approvedError });

      if (approvedError) {
        console.error('Error loading approved users:', approvedError);
        addToast({
          title: 'Failed to load approved users',
          description: approvedError.message,
          color: 'danger',
        });
        return;
      }

      // Handle case where no approved users exist
      if (!approvedUsers || approvedUsers.length === 0) {
        console.log('No approved users found');
        setUsers([]);
        addToast({
          title: 'No approved users found',
          description: 'Create your first affiliate user using the admin panel',
          color: 'warning',
        });
        return;
      }

      console.log(`Found ${approvedUsers.length} approved users`);

      // Then get profiles and referral codes separately
      const userIds = approvedUsers.map(user => user.user_id);
      console.log('User IDs to fetch:', userIds);
      
      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('affiliate_profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      console.log('Profiles query result:', { data: profiles, error: profilesError });

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        addToast({
          title: 'Failed to load user profiles',
          description: profilesError.message,
          color: 'danger',
        });
        return;
      }

      // Get referral codes
      const { data: referrers, error: referrersError } = await supabase
        .from('affiliate_referrers')
        .select('user_id, code')
        .in('user_id', userIds);

      console.log('Referrers query result:', { data: referrers, error: referrersError });

      if (referrersError) {
        console.error('Error loading referral codes:', referrersError);
        addToast({
          title: 'Failed to load referral codes',
          description: referrersError.message,
          color: 'danger',
        });
        return;
      }

      // Create lookup maps
      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const referrersMap = new Map(referrers?.map(r => [r.user_id, r]) || []);

      console.log('Profiles map size:', profilesMap.size);
      console.log('Referrers map size:', referrersMap.size);

      // Combine the data
      const transformedUsers: UserRecord[] = approvedUsers.map(user => {
        const profile = profilesMap.get(user.user_id);
        const referrer = referrersMap.get(user.user_id);
        
        console.log(`Processing user ${user.user_email}:`, {
          hasProfile: !!profile,
          hasReferrer: !!referrer,
          profile: profile,
          referrer: referrer
        });
        
        return {
          id: user.id,
          user_id: user.user_id,
          user_email: user.user_email,
          first_name: profile?.first_name || 'Unknown',
          last_name: profile?.last_name || 'User',
          status: user.status,
          created_at: user.created_at,
          referral_code: referrer?.code,
        };
      });

      console.log('Final transformed users:', transformedUsers);
      setUsers(transformedUsers);
      
      addToast({
        title: `Loaded ${transformedUsers.length} users successfully`,
        color: 'success',
      });
    } catch (error) {
      console.error('Error loading users:', error);
      addToast({
        title: 'Failed to load users',
        description: error instanceof Error ? error.message : 'Unknown error',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.referral_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast({
      title: 'Copied to clipboard',
      color: 'success',
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Affiliate Users</h1>
        <p className="text-gray-600">View and manage approved affiliate users</p>
      </div>

      <Card className="mb-6">
        <CardBody>
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Search users by email, name, or referral code..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="flex-1"
              startContent={
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            <Button
              color="primary"
              variant="flat"
              onPress={loadUsers}
              isLoading={loading}
            >
              Refresh
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardBody className="text-center py-8">
              <p className="text-gray-500">
                {loading ? 'Loading users...' : 'No users found'}
              </p>
            </CardBody>
          </Card>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardBody>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">
                        {user.first_name} {user.last_name}
                      </h3>
                      <Badge color="success" variant="flat">
                        Active
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Email:</span>
                        <div className="flex items-center gap-2">
                          <span>{user.user_email}</span>
                          <Button
                            size="sm"
                            variant="light"
                            onPress={() => copyToClipboard(user.user_email)}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-medium">Referral Code:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{user.referral_code}</span>
                          <Button
                            size="sm"
                            variant="light"
                            onPress={() => copyToClipboard(user.referral_code || '')}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-medium">Created:</span>
                        <div>{new Date(user.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      onPress={() => copyToClipboard(`Email: ${user.user_email}\nReferral Code: ${user.referral_code}`)}
                    >
                      Copy Details
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>

      {filteredUsers.length > 0 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </div>
      )}
    </div>
  );
} 