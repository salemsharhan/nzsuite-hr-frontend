import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Camera, CheckCircle, XCircle, AlertCircle, Loader2, Clock, History, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '../components/common/UIComponents';
import Modal from '../components/common/Modal';
import { attendanceLocationService, AttendanceLocationSettings } from '../services/attendanceLocationService';
import { employeeAttendanceLocationService, EmployeeAttendanceLocation } from '../services/employeeAttendanceLocationService';
import { webauthnService, WebAuthnCredential } from '../services/webauthnService';
import { employeeService } from '../services/employeeService';
import { attendanceService, AttendanceLog } from '../services/attendanceService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { StatusBadge } from '../components/common/StatusBadge';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

export default function EmployeeAttendancePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [locationSettings, setLocationSettings] = useState<AttendanceLocationSettings | null>(null);
  const [employeeLocation, setEmployeeLocation] = useState<EmployeeAttendanceLocation | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationVerified, setLocationVerified] = useState<boolean>(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [webauthnVerified, setWebauthnVerified] = useState<boolean>(false);
  const [hasWebAuthnCredential, setHasWebAuthnCredential] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [punchType, setPunchType] = useState<'check_in' | 'check_out' | null>(null);
  const [isAttendanceLogModalOpen, setIsAttendanceLogModalOpen] = useState<boolean>(false);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [employeeData, setEmployeeData] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    if (user?.company_id) {
      loadLocationSettings();
      checkWebAuthnCredential();
    }
    if (user?.employee_id) {
      loadEmployeeLocation();
      loadEmployeeData();
    }
  }, [user?.company_id, user?.employee_id]);

  // Note: Camera is now managed by MultiAngleFaceCapture component

  const loadLocationSettings = async () => {
    if (!user?.company_id) return;
    try {
      const settings = await attendanceLocationService.getByCompany(user.company_id);
      setLocationSettings(settings);
    } catch (error) {
      console.error('Error loading location settings:', error);
      toast.error('Failed to load attendance location settings');
    }
  };

  const loadEmployeeLocation = async () => {
    if (!user?.employee_id) return;
    try {
      const location = await employeeAttendanceLocationService.getByEmployee(user.employee_id);
      setEmployeeLocation(location);
    } catch (error) {
      console.error('Error loading employee location:', error);
    }
  };

  const loadEmployeeData = async () => {
    if (!user?.employee_id) return;
    try {
      const employee = await employeeService.getById(user.employee_id);
      if (employee) {
        setEmployeeData({
          name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.employeeId,
          email: employee.email || `${employee.employeeId}@company.com`
        });
      }
    } catch (error) {
      console.error('Error loading employee data:', error);
    }
  };

  const checkWebAuthnCredential = async () => {
    if (!user?.employee_id) return;
    try {
      const credentials = await webauthnService.getCredentials(user.employee_id);
      setHasWebAuthnCredential(credentials.length > 0);
    } catch (error) {
      console.error('Error checking WebAuthn credentials:', error);
    }
  };

  const getCurrentLocation = (): Promise<{ lat: number; lon: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser. Please use a modern browser with location services enabled.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          let errorMessage = 'Failed to get your location. ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Location access was denied. Please allow location access in your browser settings and try again.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location information is unavailable. Please check your device location settings.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Location request timed out. Please ensure your device has a clear view of the sky (for GPS) or is connected to WiFi/network, and try again.';
              break;
            default:
              errorMessage += 'An unknown error occurred. Please try again.';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 30000, // Increased to 30 seconds
          maximumAge: 60000 // Allow cached location up to 1 minute old
        }
      );
    });
  };

  const verifyLocation = async () => {
    try {
      // Determine which location to use: employee-specific or company default
      const activeLocation = employeeLocation && !employeeLocation.use_company_default && employeeLocation.is_active
        ? employeeLocation
        : locationSettings;

      if (!activeLocation || !activeLocation.latitude || !activeLocation.longitude) {
        toast.error('Attendance location not configured');
        return;
      }

      // Show loading state
      toast.loading('Getting your location...', { id: 'location-verification' });

      const location = await getCurrentLocation();
      setUserLocation(location);

      const verification = attendanceLocationService.verifyLocation(
        location.lat,
        location.lon,
        activeLocation.latitude,
        activeLocation.longitude,
        activeLocation.radius_meters
      );

      setDistance(verification.distance);
      setLocationVerified(verification.verified);

      toast.dismiss('location-verification');

      if (!verification.verified) {
        toast.error(`You are ${verification.distance.toFixed(0)}m away from the location. Please move closer.`, {
          duration: 5000
        });
      } else {
        toast.success('Location verified!', {
          duration: 3000
        });
      }
    } catch (error: any) {
      console.error('Error verifying location:', error);
      toast.dismiss('location-verification');
      
      // Provide more helpful error messages
      if (error.message) {
        toast.error(error.message, {
          duration: 6000
        });
      } else if (error.code === 3) {
        toast.error('Location request timed out. Please ensure your device has GPS/WiFi enabled and try again.', {
          duration: 6000
        });
      } else {
        toast.error('Failed to get your location. Please check your browser permissions and device settings.', {
          duration: 6000
        });
      }
    }
  };


  const handleWebAuthnRegister = async () => {
    if (!user?.employee_id || !employeeData) {
      toast.error('Employee data not available');
      return;
    }

    if (!webauthnService.isSupported()) {
      toast.error('WebAuthn is not supported in this browser. Please use a modern browser with Face ID, Touch ID, or Windows Hello.');
      return;
    }

    try {
      setIsRegistering(true);
      
      // Register WebAuthn credential
      const { credential, deviceName } = await webauthnService.register(
        user.employee_id,
        employeeData.name,
        employeeData.email,
        'HR System' // Company name - you might want to fetch this from settings
      );

      // Save credential to database
      await webauthnService.saveCredential(
        user.employee_id,
        credential,
        deviceName
      );

      toast.success('Device registered successfully! You can now use Face ID/Touch ID for attendance.');
      await checkWebAuthnCredential();
    } catch (error: any) {
      console.error('WebAuthn registration error:', error);
      toast.error(error.message || 'Failed to register device');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleWebAuthnAuthenticate = async () => {
    if (!user?.employee_id) {
      toast.error('Employee ID not found');
      return;
    }

    if (!webauthnService.isSupported()) {
      toast.error('WebAuthn is not supported in this browser.');
      return;
    }

    try {
      setIsAuthenticating(true);
      
      // Authenticate with WebAuthn
      const assertion = await webauthnService.authenticate(user.employee_id);

      // Verify with server
      const result = await webauthnService.verifyAuthentication(
        user.employee_id,
        assertion,
        '' // Challenge will be handled by server
      );

      if (result.verified) {
        setWebauthnVerified(true);
        toast.success('WebAuthn verification successful!');
      } else {
        toast.error('WebAuthn verification failed');
      }
    } catch (error: any) {
      console.error('WebAuthn authentication error:', error);
      toast.error(error.message || 'WebAuthn authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const loadAttendanceLogs = async () => {
    if (!user?.employee_id) return;
    try {
      setLoadingLogs(true);
      const logs = await attendanceService.getByEmployee(user.employee_id);
      setAttendanceLogs(logs);
    } catch (error) {
      console.error('Error loading attendance logs:', error);
      toast.error('Failed to load attendance logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const openAttendanceLogs = () => {
    setIsAttendanceLogModalOpen(true);
    loadAttendanceLogs();
  };

  const submitAttendance = async (type: 'check_in' | 'check_out') => {
    if (!user?.employee_id) {
      toast.error('Employee ID not found');
      return;
    }

      // Determine which location settings to use
      const activeSettings = employeeLocation && !employeeLocation.use_company_default && employeeLocation.is_active
        ? { ...locationSettings, latitude: employeeLocation.latitude, longitude: employeeLocation.longitude, radius_meters: employeeLocation.radius_meters, is_active: employeeLocation.is_active }
        : locationSettings;

      // Verify location if required
      if (activeSettings?.is_active) {
        if (!locationVerified) {
          toast.error('Please verify your location first');
          return;
        }
      }

      // Verify WebAuthn if required
      if (locationSettings?.require_face_verification) {
        if (!webauthnVerified && hasWebAuthnCredential) {
          toast.error('Please verify with WebAuthn first (Face ID/Touch ID)');
          return;
        }
        if (!hasWebAuthnCredential) {
          toast.error('Please register your device first');
          return;
        }
      }

    try {
      setIsSubmitting(true);
      setPunchType(type);

      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toISOString();

      // Get WebAuthn credential info if verified
      let webauthnCredentialId: string | null = null;
      let webauthnDeviceName: string | null = null;
      if (webauthnVerified) {
        const credentials = await webauthnService.getCredentials(user.employee_id);
        if (credentials.length > 0) {
          webauthnCredentialId = credentials[0].credential_id;
          webauthnDeviceName = credentials[0].device_name || null;
        }
      }

      // Create attendance record
      const attendanceData: any = {
        employee_id: user.employee_id,
        date: date,
        [type === 'check_in' ? 'check_in' : 'check_out']: time,
        status: 'Present',
        location_verified: locationVerified,
        webauthn_verified: webauthnVerified,
        verification_method: locationVerified && webauthnVerified ? 'geo_webauthn' : 
                             locationVerified ? 'geo_only' : 
                             webauthnVerified ? 'webauthn_only' : 'manual',
        device_info: navigator.userAgent
      };

      if (userLocation) {
        attendanceData.latitude = userLocation.lat;
        attendanceData.longitude = userLocation.lon;
        if (activeLocation && activeLocation.latitude && activeLocation.longitude) {
          attendanceData.distance_from_location_meters = distance;
        }
      }

      if (webauthnCredentialId) {
        attendanceData.webauthn_credential_id = webauthnCredentialId;
        attendanceData.webauthn_device_name = webauthnDeviceName;
      }

      await attendanceService.createPunch(attendanceData);

      toast.success(`${type === 'check_in' ? 'Check-in' : 'Check-out'} recorded successfully!`);
      
      // Reset states
      setLocationVerified(false);
      setWebauthnVerified(false);
      setUserLocation(null);
      setDistance(null);
    } catch (error: any) {
      console.error('Error submitting attendance:', error);
      toast.error(error.message || 'Failed to submit attendance');
    } finally {
      setIsSubmitting(false);
      setPunchType(null);
    }
  };

  // Determine which location to display
  const activeLocation = employeeLocation && !employeeLocation.use_company_default && employeeLocation.is_active
    ? employeeLocation
    : locationSettings;

  if (!activeLocation && !locationSettings) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto mb-4 text-muted-foreground" size={48} />
        <p className="text-muted-foreground">Attendance location not configured. Please contact your administrator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock size={24} />
            Mark Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={18} className="text-blue-400" />
                <span className="font-semibold">
                  {activeLocation?.location_name || locationSettings?.location_name || 'Location'}
                  {employeeLocation && !employeeLocation.use_company_default && (
                    <Badge variant="outline" className="ml-2 text-xs">Admin Set</Badge>
                  )}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Allowed radius: {activeLocation?.radius_meters || locationSettings?.radius_meters || 100}m
                {employeeLocation?.use_company_default ? (
                  <span className="ml-2">(Using company default)</span>
                ) : employeeLocation ? (
                  <span className="ml-2">(Set by administrator)</span>
                ) : null}
              </p>
            </div>

            {/* Location Verification */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={20} className="text-primary" />
                  <span className="font-semibold">Location Verification</span>
                </div>
                {locationVerified ? (
                  <Badge variant="success" className="flex items-center gap-1">
                    <CheckCircle size={14} />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline">Not Verified</Badge>
                )}
              </div>
              
              {userLocation && (
                <div className="text-sm text-muted-foreground">
                  Your location: {userLocation.lat.toFixed(6)}, {userLocation.lon.toFixed(6)}
                  {distance !== null && (
                    <span className="ml-2">
                      • Distance: {distance.toFixed(0)}m
                    </span>
                  )}
                </div>
              )}

              <Button
                onClick={verifyLocation}
                disabled={isSubmitting}
                className="w-full"
              >
                {locationVerified ? 'Re-verify Location' : 'Verify Location'}
              </Button>
            </div>

            {/* WebAuthn Verification */}
            {locationSettings?.require_face_verification && (
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-purple-400" />
                    <span className="font-semibold">Biometric Verification</span>
                  </div>
                  {hasWebAuthnCredential ? (
                    webauthnVerified ? (
                      <Badge variant="success" className="flex items-center gap-1">
                        <CheckCircle size={14} />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not Verified</Badge>
                    )
                  ) : (
                    <Badge variant="warning">Setup Required</Badge>
                  )}
                </div>

                {!hasWebAuthnCredential && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-sm text-yellow-400 mb-2">
                      Register your device to use Face ID, Touch ID, or Windows Hello for attendance.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your biometric data stays on your device and is never sent to the server.
                    </p>
                  </div>
                )}

                {!hasWebAuthnCredential ? (
                  <Button
                    onClick={handleWebAuthnRegister}
                    variant="outline"
                    className="w-full"
                    disabled={isSubmitting || isRegistering || !webauthnService.isSupported()}
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 size={18} className="mr-2 animate-spin" />
                        Registering Device...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={18} className="mr-2" />
                        Register Device (Face ID/Touch ID)
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleWebAuthnAuthenticate}
                    variant="outline"
                    className="w-full"
                    disabled={isSubmitting || isAuthenticating || webauthnVerified}
                  >
                    {isAuthenticating ? (
                      <>
                        <Loader2 size={18} className="mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : webauthnVerified ? (
                      <>
                        <CheckCircle size={18} className="mr-2" />
                        Verified
                      </>
                    ) : (
                      <>
                        <CheckCircle size={18} className="mr-2" />
                        Verify with Face ID/Touch ID
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Attendance Buttons */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <Button
                onClick={() => submitAttendance('check_in')}
                disabled={!locationVerified || (locationSettings?.require_face_verification && !webauthnVerified && hasWebAuthnCredential) || isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting && punchType === 'check_in' ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    Recording Check-in...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} className="mr-2" />
                    Check In
                  </>
                )}
              </Button>

              <Button
                onClick={() => submitAttendance('check_out')}
                disabled={!locationVerified || (locationSettings?.require_face_verification && !webauthnVerified && hasWebAuthnCredential) || isSubmitting}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {isSubmitting && punchType === 'check_out' ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    Recording Check-out...
                  </>
                ) : (
                  <>
                    <XCircle size={20} className="mr-2" />
                    Check Out
                  </>
                )}
              </Button>

              <Button
                onClick={openAttendanceLogs}
                variant="outline"
                className="w-full"
              >
                <History size={18} className="mr-2" />
                View Attendance History
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Logs Modal */}
      <Modal
        isOpen={isAttendanceLogModalOpen}
        onClose={() => setIsAttendanceLogModalOpen(false)}
        title="Attendance History"
        size="xl"
      >
        <div className="space-y-4">
          {loadingLogs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : attendanceLogs.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto mb-4 text-muted-foreground" size={48} />
              <p className="text-muted-foreground">No attendance records found</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {attendanceLogs.map((log) => (
                <Card key={log.id} className="border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar size={16} className="text-muted-foreground" />
                          <span className="font-semibold">
                            {new Date(log.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        <StatusBadge status={log.status} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      {log.check_in && (
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <div className="text-xs text-muted-foreground mb-1">Check In</div>
                          <div className="font-semibold text-green-400">
                            {new Date(log.check_in).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      )}
                      {log.check_out && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <div className="text-xs text-muted-foreground mb-1">Check Out</div>
                          <div className="font-semibold text-red-400">
                            {new Date(log.check_out).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {(log.late_minutes > 0 || log.overtime_minutes > 0) && (
                      <div className="flex gap-4 mt-3 pt-3 border-t border-white/10">
                        {log.late_minutes > 0 && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Late: </span>
                            <span className="font-semibold text-orange-400">{log.late_minutes} min</span>
                          </div>
                        )}
                        {log.overtime_minutes > 0 && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Overtime: </span>
                            <span className="font-semibold text-blue-400">{log.overtime_minutes} min</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}

