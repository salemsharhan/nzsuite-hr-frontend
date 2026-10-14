import { ModalEnhanced } from '../common/ModalEnhanced';
import { Request } from '../../services/selfServiceApi';
import { EmployeeRequestSteps, EmployeeStatusBadge } from '../approvals/EmployeeRequestProgress';
import { Clock, User, MessageSquare, Paperclip } from 'lucide-react';

interface RequestDetailModalProps {
  request: Request;
  isOpen: boolean;
  onClose: () => void;
}

export const RequestDetailModal = ({ request, isOpen, onClose }: RequestDetailModalProps) => {
  return (
    <ModalEnhanced
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Request Details"
    >
      <div className="p-6 space-y-6">
        {/* Header Info */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold text-foreground">{request.type}</h3>
            <p className="text-sm text-muted-foreground mt-1">{request.id} • {request.category}</p>
          </div>
          <EmployeeStatusBadge status={request.status} currentApprover={request.currentApprover} category={request.category} />
        </div>

        {/* Where the request is now */}
        <div className="rounded-lg border border-border p-4">
          <EmployeeRequestSteps status={request.status} currentApprover={request.currentApprover} category={request.category} />
        </div>

        {/* Timeline */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Timeline
          </h4>
          <div className="space-y-3">
            {request.timeline.map((event, index) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2 h-2 rounded-full ${
                    index === request.timeline.length - 1 ? 'bg-primary' : 'bg-muted-foreground'
                  }`} />
                  {index < request.timeline.length - 1 && (
                    <div className="w-0.5 h-full bg-border mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm font-medium text-foreground">{event.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {event.actor} • {event.timestamp}
                  </p>
                  {event.notes && (
                    <p className="text-sm text-muted-foreground mt-1">{event.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Request Details */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Request Details</h4>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            {Object.entries(request.formData).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-sm text-muted-foreground capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span className="text-sm text-foreground font-medium">
                  {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Comments */}
        {request.comments.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Comments
            </h4>
            <div className="space-y-3">
              {request.comments.map(comment => (
                <div key={comment.id} className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{comment.author}</span>
                    <span className="text-xs text-muted-foreground">{comment.timestamp}</span>
                  </div>
                  <p className="text-sm text-foreground">{comment.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        {request.attachments.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attachments
            </h4>
            <div className="space-y-2">
              {request.attachments.map(attachment => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors"
                >
                  <span className="text-sm text-foreground">{attachment.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(attachment.size / 1024).toFixed(2)} KB
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>
    </ModalEnhanced>
  );
};
