import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Phone, Calendar, MapPin, Building2, Edit2, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function EmployeeProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployeeData();
  }, []);

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      const employeeDataStr = sessionStorage.getItem('employee_data');
      if (employeeDataStr) {
        const data = JSON.parse(employeeDataStr);
        setEmployeeData(data);
      }
    } catch (error) {
      console.error('Error loading employee data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!employeeData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Employee data not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <User className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">
              {employeeData.first_name} {employeeData.last_name}
            </h2>
            <p className="text-muted-foreground text-sm mb-4">
              {employeeData.employee_id || employeeData.external_id}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="gap-2"
            >
              {isEditing ? (
                <>
                  <X className="w-4 h-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">{employeeData.email || 'N/A'}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Phone</Label>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">{employeeData.phone || 'N/A'}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Date of Birth</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {employeeData.date_of_birth ? new Date(employeeData.date_of_birth).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Address</Label>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {employeeData.address || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employment Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Employment Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Department</Label>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">{employeeData.department || 'N/A'}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Position</Label>
              <p className="text-sm font-medium">{employeeData.designation || employeeData.position || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Join Date</Label>
              <p className="text-sm font-medium">
                {employeeData.join_date ? new Date(employeeData.join_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Status</Label>
              <p className="text-sm font-medium">{employeeData.status || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

