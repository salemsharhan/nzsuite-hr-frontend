import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { documentRequestService, DocumentRequest } from '@/services/documentRequestService';
import { documentService, Document } from '@/services/documentService';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Search, 
  Filter, 
  FileText, 
  Download, 
  Upload, 
  CheckCircle, 
  XCircle, 
  Clock,
  Eye,
  User
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function DocumentRequestsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'In Progress' | 'Completed' | 'Rejected'>('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);
  const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);
  const [fulfillMode, setFulfillMode] = useState<'select' | 'upload'>('select');
  const [employeeDocuments, setEmployeeDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 25;

  useEffect(() => {
    if (user?.company_id) {
      loadRequests();
    }
  }, [user?.company_id, statusFilter, documentTypeFilter, currentPage]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const filters = {
        status: statusFilter,
        document_type: documentTypeFilter !== 'all' ? documentTypeFilter : undefined,
        page: currentPage,
        limit: itemsPerPage
      };
      const [data, count] = await Promise.all([
        documentRequestService.getAll(filters),
        documentRequestService.getCount(filters)
      ]);
      setRequests(data);
      setTotalCount(count);
    } catch (error) {
      console.error('Error loading document requests:', error);
      toast.error('Failed to load document requests');
    } finally {
      setLoading(false);
    }
  };

  const handleFulfillClick = async (request: DocumentRequest) => {
    setSelectedRequest(request);
    setIsFulfillModalOpen(true);
    setFulfillMode('select');
    setSelectedDocumentId('');
    setUploadFile(null);
    setNotes('');
    
    // Load employee documents
    try {
      const docs = await documentService.getAll(request.employee_id);
      setEmployeeDocuments(docs);
    } catch (error) {
      console.error('Error loading employee documents:', error);
      toast.error('Failed to load employee documents');
    }
  };

  const handleFulfill = async () => {
    if (!selectedRequest || !user?.id) return;
    
    try {
      setUploading(true);
      
      if (fulfillMode === 'select') {
        if (!selectedDocumentId) {
          toast.error('Please select a document');
          return;
        }
        await documentRequestService.fulfillWithExistingDocument(
          selectedRequest.id,
          selectedDocumentId,
          user.id,
          notes
        );
        toast.success('Document request fulfilled successfully');
      } else {
        if (!uploadFile) {
          toast.error('Please select a file to upload');
          return;
        }
        
        // Upload the file
        const uploadedDoc = await documentService.upload(
          uploadFile,
          null,
          undefined,
          selectedRequest.employee_id
        );
        
        // Fulfill the request with the uploaded document URL
        await documentRequestService.fulfillWithNewDocument(
          selectedRequest.id,
          uploadedDoc.url,
          user.id,
          notes
        );
        toast.success('Document uploaded and request fulfilled successfully');
      }
      
      setIsFulfillModalOpen(false);
      setSelectedRequest(null);
      await loadRequests();
    } catch (error) {
      console.error('Error fulfilling document request:', error);
      toast.error('Failed to fulfill document request');
    } finally {
      setUploading(false);
    }
  };

  const handleReject = async (request: DocumentRequest) => {
    if (!user?.id) return;
    
    if (!confirm('Are you sure you want to reject this document request?')) {
      return;
    }
    
    try {
      await documentRequestService.updateStatus(
        request.id,
        'Rejected',
        user.id,
        'Request rejected by admin'
      );
      toast.success('Document request rejected');
      await loadRequests();
    } catch (error) {
      console.error('Error rejecting document request:', error);
      toast.error('Failed to reject document request');
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.document_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.employees?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.employees?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.employees?.employee_id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return <StatusBadge status="Approved" />;
      case 'Rejected':
        return <StatusBadge status="Rejected" />;
      case 'In Progress':
        return <StatusBadge status="In Review" />;
      case 'Pending':
        return <StatusBadge status="Pending" />;
      default:
        return <StatusBadge status={status as any} />;
    }
  };

  // Get unique document types for filter
  const documentTypes = Array.from(new Set(requests.map(r => r.document_type)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Document Requests</h1>
          <p className="text-muted-foreground mt-1">Manage employee document requests</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by employee name, ID, or document type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {documentTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Document Requests ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No document requests found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Request ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Employee</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Document Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Purpose</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Language</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Requested</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono text-muted-foreground">
                          {request.id.substring(0, 8)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {request.employees?.first_name} {request.employees?.last_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {request.employees?.employee_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span>{request.document_type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm">{request.purpose || 'N/A'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">
                          {request.language?.toUpperCase() || 'EN'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-muted-foreground">
                          {new Date(request.requested_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {request.status === 'Pending' || request.status === 'In Progress' ? (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleFulfillClick(request)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Fulfill
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(request)}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          ) : request.status === 'Completed' && (request.document_id || request.uploaded_document_url) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const url = request.uploaded_document_url || request.documents?.url;
                                if (url) {
                                  window.open(url, '_blank');
                                }
                              }}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fulfill Modal */}
      <Dialog open={isFulfillModalOpen} onOpenChange={setIsFulfillModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fulfill Document Request</DialogTitle>
            <DialogDescription>
              Select an existing document or upload a new one to fulfill this request
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Request Details</div>
                <div className="font-medium">{selectedRequest.document_type}</div>
                <div className="text-sm text-muted-foreground">
                  Employee: {selectedRequest.employees?.first_name} {selectedRequest.employees?.last_name}
                </div>
                {selectedRequest.purpose && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Purpose: {selectedRequest.purpose}
                  </div>
                )}
              </div>

              {/* Mode Toggle */}
              <div className="flex gap-2">
                <Button
                  variant={fulfillMode === 'select' ? 'default' : 'outline'}
                  onClick={() => setFulfillMode('select')}
                  className="flex-1"
                >
                  Select Existing Document
                </Button>
                <Button
                  variant={fulfillMode === 'upload' ? 'default' : 'outline'}
                  onClick={() => setFulfillMode('upload')}
                  className="flex-1"
                >
                  Upload New Document
                </Button>
              </div>

              {/* Select Existing Document */}
              {fulfillMode === 'select' && (
                <div className="space-y-2">
                  <Label>Select Document</Label>
                  <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a document..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeDocuments.length === 0 ? (
                        <SelectItem value="" disabled>No documents available</SelectItem>
                      ) : (
                        employeeDocuments.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.name} ({doc.type})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {employeeDocuments.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No documents found for this employee. Please upload a new document.
                    </p>
                  )}
                </div>
              )}

              {/* Upload New Document */}
              {fulfillMode === 'upload' && (
                <div className="space-y-2">
                  <Label>Upload Document</Label>
                  <Input
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                  {uploadFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this fulfillment..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsFulfillModalOpen(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleFulfill}
                  disabled={uploading || (fulfillMode === 'select' && !selectedDocumentId) || (fulfillMode === 'upload' && !uploadFile)}
                >
                  {uploading ? 'Processing...' : 'Fulfill Request'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

