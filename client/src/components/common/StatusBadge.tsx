import { cn } from './UIComponents';

export type RequestStatus = 'Pending' | 'In Review' | 'Approved' | 'Rejected' | 'Cancelled' | 'Completed' | 'Draft';

interface StatusBadgeProps {
  status: RequestStatus | string; // Allow string for flexibility
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
  'Pending': {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-500',
    border: 'border-yellow-500/20'
  },
  'In Review': {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/20'
  },
  'Approved': {
    bg: 'bg-green-500/10',
    text: 'text-green-500',
    border: 'border-green-500/20'
  },
  'Rejected': {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    border: 'border-red-500/20'
  },
  'Cancelled': {
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
    border: 'border-gray-500/20'
  },
  'Completed': {
    bg: 'bg-green-500/10',
    text: 'text-green-500',
    border: 'border-green-500/20'
  },
  'Draft': {
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
    border: 'border-gray-500/20'
  },
  'Pending_GM': {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/20'
  },
  'On_Hold': {
    bg: 'bg-orange-500/10',
    text: 'text-orange-500',
    border: 'border-orange-500/20'
  }
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status] || {
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
    border: 'border-gray-500/20'
  };
  
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      config.bg,
      config.text,
      config.border,
      className
    )}>
      {status}
    </span>
  );
};
