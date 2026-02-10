import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, Eye, Plus } from 'lucide-react';
import { selfServiceApi, Request } from '../services/selfServiceApi';
import { StatusBadge, RequestStatus } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { SubmitRequestModal } from '../components/selfservice/SubmitRequestModal';
import { RequestDetailModal } from '../components/selfservice/RequestDetailModal';
import { REQUEST_CATEGORIES } from '../config/selfServiceRequests';
import { toast } from 'sonner';

export default function MyRequestsPage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [requests, statusFilter, categoryFilter, searchQuery, dateFrom, dateTo]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await selfServiceApi.getAllRequests();
      setRequests(data);
    } catch (error) {
      console.error('Failed to load requests:', error);
      toast.error(t('requests.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...requests];

    if (statusFilter) {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (categoryFilter) {
      filtered = filtered.filter(r => r.category === categoryFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.id.toLowerCase().includes(query) ||
        r.type.toLowerCase().includes(query)
      );
    }

    if (dateFrom) {
      filtered = filtered.filter(r => r.date >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(r => r.date <= dateTo);
    }

    setFilteredRequests(filtered);
  };

  const handleRequestClick = (request: Request) => {
    setSelectedRequest(request);
  };

  const handleRequestSubmitted = () => {
    loadRequests();
    toast.success(t('requests.requestSubmittedSuccess'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('requests.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('requests.subtitle')}</p>
        </div>
        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          {t('requests.newRequest')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('requests.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RequestStatus | '')}
            className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
          >
            <option value="">{t('requests.allStatuses')}</option>
            <option value="Pending">{t('requests.pending')}</option>
            <option value="In Review">{t('requests.inReview')}</option>
            <option value="Approved">{t('requests.approved')}</option>
            <option value="Rejected">{t('requests.rejected')}</option>
            <option value="Cancelled">{t('requests.cancelled')}</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
          >
            <option value="">{t('requests.allCategories')}</option>
            {REQUEST_CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.title}>{cat.title}</option>
            ))}
          </select>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              placeholder={t('requests.from')}
            />
            <span className="text-muted-foreground">{t('requests.to')}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              placeholder={t('requests.to')}
            />
          </div>
        </div>

        {/* Active Filters Summary */}
        {(statusFilter || categoryFilter || searchQuery || dateFrom || dateTo) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <span className="text-sm text-muted-foreground">{t('requests.activeFilters')}</span>
            {statusFilter && (
              <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                {t('requests.status')}: {statusFilter}
              </span>
            )}
            {categoryFilter && (
              <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                {t('requests.category')}: {categoryFilter}
              </span>
            )}
            {searchQuery && (
              <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                {t('requests.search')}: {searchQuery}
              </span>
            )}
            <button
              onClick={() => {
                setStatusFilter('');
                setCategoryFilter('');
                setSearchQuery('');
                setDateFrom('');
                setDateTo('');
              }}
              className="ml-auto text-sm text-primary hover:underline"
            >
              {t('requests.clearAll')}
            </button>
          </div>
        )}
      </div>

      {/* Requests Table */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={Filter}
          title={t('requests.noRequestsFound')}
          description={requests.length === 0 
            ? t('requests.noRequestsDescription')
            : t('requests.noRequestsMatchFilters')}
          action={requests.length === 0 ? {
            label: t('requests.submitRequest'),
            onClick: () => setIsSubmitModalOpen(true)
          } : undefined}
        />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('requests.requestId')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('requests.type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('requests.categoryLabel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('requests.date')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('requests.statusLabel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('requests.currentApprover')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('requests.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRequests.map(request => (
                  <tr
                    key={request.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleRequestClick(request)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-foreground">{request.id}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-foreground">{request.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-muted-foreground">{request.category}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-muted-foreground">{request.date}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={request.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-muted-foreground">
                        {request.currentApprover || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestClick(request);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        {t('requests.view')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <SubmitRequestModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={handleRequestSubmitted}
      />

      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  );
}
