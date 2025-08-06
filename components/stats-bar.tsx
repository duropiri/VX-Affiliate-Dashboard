'use client';

import { Card, CardBody } from '@heroui/react';
import { TrendingUp, Users, CreditCard, DollarSign } from 'lucide-react';
import { TbClick, TbUsers, TbUserDollar} from "react-icons/tb";


interface StatsBarProps {
  clicks: number;
  referrals: number;
  customers: number;
  earnings: number;
}

const statItems = [
  {
    label: 'Total Clicks',
    key: 'clicks' as const,
    icon: TbClick,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    label: 'Referrals',
    key: 'referrals' as const,
    icon: Users,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    label: 'Customers',
    key: 'customers' as const,
    icon: TbUserDollar,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    label: 'Total Earnings',
    key: 'earnings' as const,
    icon: DollarSign,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
  },
];

export function StatsBar({ clicks, referrals, customers, earnings }: StatsBarProps) {
  const stats = { clicks, referrals, customers, earnings };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <Card key={item.label} className="border border-primary/20">
          <CardBody className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${item.bg}`}>
                <item.icon className={`h-6 w-6 ${item.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{item.label}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {item.key === 'earnings' 
                    ? `$${stats[item.key].toFixed(2)}`
                    : stats[item.key].toLocaleString()
                  }
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}