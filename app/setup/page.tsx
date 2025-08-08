'use client';

import { useState } from 'react';
import { Card, CardBody, CardHeader, Button, Input, Form } from '@heroui/react';
import { supabase } from '@/lib/supabase';
import { addToast } from '@heroui/toast';

export default function SetupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if any approved users exist
      const { data: approvedUsers, error: checkError } = await supabase
        .from('approved_users')
        .select('user_id')
        .limit(1);

      if (checkError) {
        console.error('Error checking approved users:', checkError);
        addToast({
          title: 'Failed to check existing users',
          color: 'danger',
        });
        return;
      }

      if (approvedUsers && approvedUsers.length > 0) {
        addToast({
          title: 'Admin user already exists. Please sign in instead.',
          color: 'danger',
        });
        return;
      }

      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
          },
        },
      });

      if (authError) {
        addToast({
          title: authError.message,
          color: 'danger',
        });
        return;
      }

      if (authData.user) {
        // Approve the user
        const { error: approveError } = await supabase
          .from('approved_users')
          .insert({
            user_id: authData.user.id,
            user_email: email.toLowerCase(),
            approved_by: authData.user.id, // Self-approval for first admin
            status: 'active',
            notes: 'First admin user - created during setup',
          });

        if (approveError) {
          console.error('Error approving user:', approveError);
          addToast({
            title: 'Failed to approve user',
            color: 'danger',
          });
          return;
        }

        // Create user profile
        const { error: profileError } = await supabase
          .from('affiliate_profiles')
          .insert({
            user_id: authData.user.id,
            user_aryeo_id: authData.user.id,
            user_email: email.toLowerCase(),
            first_name: firstName,
            last_name: lastName,
            notifications: {
              email_reports: true,
              sms_alerts: false,
              push_notifications: true,
            },
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          addToast({
            title: 'Failed to create user profile',
            color: 'danger',
          });
          return;
        }

        // Create referral code
        const { error: referralError } = await supabase
          .from('affiliate_referrers')
          .insert({
            user_id: authData.user.id,
            code: 'ADMIN001',
          });

        if (referralError) {
          console.error('Error creating referral code:', referralError);
          addToast({
            title: 'Failed to create referral code',
            color: 'danger',
          });
          return;
        }

        // Create initial KPIs
        const { error: kpiError } = await supabase
          .from('dashboard_kpis')
          .insert({
            user_id: authData.user.id,
            clicks: 0,
            referrals: 0,
            customers: 0,
          });

        if (kpiError) {
          console.error('Error creating KPIs:', kpiError);
          addToast({
            title: 'Failed to create initial KPIs',
            color: 'danger',
          });
          return;
        }

        addToast({
          title: 'First admin user created successfully! You can now sign in.',
          color: 'success',
        });
        
        // Clear form
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
      }
    } catch (error: any) {
      console.error('Error creating first admin:', error);
      addToast({
        title: error.message || 'Failed to create admin user',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-purple-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center justify-center pb-2">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">A</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Setup First Admin</h1>
            <p className="text-gray-600">Create the first admin user for the affiliate portal</p>
          </div>
        </CardHeader>
        
        <CardBody className="pt-0">
          <Form onSubmit={handleCreateFirstAdmin} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="First name"
                value={firstName}
                onValueChange={setFirstName}
                isRequired
                variant="bordered"
              />
              <Input
                label="Last Name"
                placeholder="Last name"
                value={lastName}
                onValueChange={setLastName}
                isRequired
                variant="bordered"
              />
            </div>
            
            <Input
              type="email"
              label="Email Address"
              placeholder="Enter admin email"
              value={email}
              onValueChange={setEmail}
              isRequired
              variant="bordered"
            />
            
            <Input
              type="password"
              label="Password"
              placeholder="Enter admin password"
              value={password}
              onValueChange={setPassword}
              isRequired
              variant="bordered"
            />
            
            <Button
              type="submit"
              color="primary"
              className="w-full"
              isLoading={loading}
            >
              Create First Admin
            </Button>
            
            <p className="text-sm text-gray-500 text-center">
              This will create the first admin user with full access to the system.
              Only run this once during initial setup.
            </p>
          </Form>
        </CardBody>
      </Card>
    </div>
  );
} 