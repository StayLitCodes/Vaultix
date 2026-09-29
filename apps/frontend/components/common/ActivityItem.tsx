import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  PlusCircle, 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  Wallet, 
  Activity, 
  AlertTriangle, 
  RefreshCw,
  Clock,
  ArrowRight
} from 'lucide-react';
import { IEscrowEvent } from '@/types/escrow';
import { useLocale, useTranslations } from 'next-intl';
import { formatLocaleNumber, formatRelativeTime, type Locale } from '@/lib/i18n';

interface ActivityItemProps {
  event: IEscrowEvent;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ event }) => {
  const t = useTranslations('activity.events');
  const feedT = useTranslations('activity');
  const locale = useLocale() as Locale;
  const config = useMemo(() => {
    switch (event.eventType) {
      case 'CREATED':
        return {
          icon: <PlusCircle className="w-5 h-5 text-blue-500" />,
          title: t('createdTitle'),
          description: t('createdDescription'),
          color: 'bg-blue-50'
        };
      case 'PARTY_ADDED':
        return {
          icon: <UserPlus className="w-5 h-5 text-indigo-500" />,
          title: t('partyAddedTitle'),
          description: t('partyAddedDescription', { user: `${event.actorId?.slice(0, 6)}...` }),
          color: 'bg-indigo-50'
        };
      case 'PARTY_ACCEPTED':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
          title: t('partyAcceptedTitle'),
          description: t('partyAcceptedDescription'),
          color: 'bg-green-50'
        };
      case 'PARTY_REJECTED':
        return {
          icon: <XCircle className="w-5 h-5 text-red-500" />,
          title: t('partyRejectedTitle'),
          description: t('partyRejectedDescription'),
          color: 'bg-red-50'
        };
      case 'FUNDED':
        return {
          icon: <Wallet className="w-5 h-5 text-emerald-500" />,
          title: t('fundedTitle'),
          description: t('fundedDescription'),
          color: 'bg-emerald-50'
        };
      case 'CONDITION_MET':
        return {
          icon: <Activity className="w-5 h-5 text-amber-500" />,
          title: t('conditionMetTitle'),
          description: t('conditionMetDescription'),
          color: 'bg-amber-50'
        };
      case 'COMPLETED':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
          title: t('completedTitle'),
          description: t('completedDescription'),
          color: 'bg-green-100'
        };
      case 'CANCELLED':
        return {
          icon: <XCircle className="w-5 h-5 text-gray-500" />,
          title: t('cancelledTitle'),
          description: t('cancelledDescription'),
          color: 'bg-gray-100'
        };
      case 'DISPUTED':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-rose-500" />,
          title: t('disputedTitle'),
          description: t('disputedDescription'),
          color: 'bg-rose-50'
        };
      case 'UPDATED':
        return {
          icon: <RefreshCw className="w-5 h-5 text-sky-500" />,
          title: t('updatedTitle'),
          description: t('updatedDescription'),
          color: 'bg-sky-50'
        };
      default:
        return {
          icon: <Activity className="w-5 h-5 text-gray-400" />,
          title: t('defaultTitle'),
          description: t('defaultDescription'),
          color: 'bg-gray-50'
        };
    }
  }, [event.eventType, event.actorId, t]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors group"
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${config.color} flex items-center justify-center`}>
        {config.icon}
      </div>
      
      <div className="flex-grow min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {config.title}
          </h4>
          <span className="text-[10px] uppercase font-medium text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(new Date(event.createdAt), locale)}
          </span>
        </div>
          <p className="text-xs text-gray-500 leading-relaxed">
          {config.description}
        </p>
        
        {event.data?.amount && (
          <div className="mt-2 text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block">
            {formatLocaleNumber(Number(event.data.amount), locale)} {event.data.asset}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400" aria-label={feedT('viewDetails')}>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

export default ActivityItem;
