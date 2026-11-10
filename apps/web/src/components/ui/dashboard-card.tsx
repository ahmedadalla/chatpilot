import * as React from 'react';
import { Card, CardContent } from './card';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  className?: string;
  accentColor?: 'emerald' | 'blue' | 'purple' | 'amber' | 'rose';
}

export function DashboardCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  accentColor = 'emerald',
}: DashboardCardProps) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  };

  return (
    <Card className={cn('relative overflow-hidden transition-all hover:shadow-md', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          {Icon && (
            <div className={cn('rounded-xl border p-2.5 shadow-xs', colorMap[accentColor])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">{value}</p>
          {(subtitle || trend) && (
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              {trend && (
                <span
                  className={cn(
                    'font-bold',
                    trend.isPositive ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  {trend.isPositive ? '+' : ''}
                  {trend.value}%
                </span>
              )}
              {subtitle && <span>{subtitle}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
