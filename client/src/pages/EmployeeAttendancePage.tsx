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
import { adminApi } from '../services/api';
import { companySettingsService } from '../services/companySettingsService';
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
  const [todayAttendance, setTodayAttendance] = useState<AttendanceLog | null>(null);
  const [hasMultipleShifts, setHasMultipleShifts] = useState<boolean>(false);
  const [loadingTodayAttendance, setLoadingTodayAttendance] = useState<boolean>(false);
  const [todayRawRecords, setTodayRawRecords] = useState<any[]>([]);
  const [currentShiftState, setCurrentShiftState] = useState<'checked_in' | 'checked_out' | 'none'>('none');

  useEffect(() => {
    if (user?.company_id) {
      loadLocationSettings();
      checkWebAuthnCredential();
    }
    if (user?.employee_id) {
      loadEmployeeLocation();
      loadEmployeeData();
      loadTodayAttendance();
      checkMultipleShifts();
    }
  }, [user?.company_id, user?.employee_id]);

  // Auto-verify location when location settings are loaded
  useEffect(() => {
    const autoVerify = async () => {
      const activeLocation = employeeLocation && !employeeLocation.use_company_default && employeeLocation.is_active
        ? employeeLocation
        : locationSettings;

      if (activeLocation && activeLocation.latitude && activeLocation.longitude && activeLocation.is_active && !locationVerified) {
        try {
          await verifyLocation();
        } catch (error) {
          // Silently fail - user can manually verify if needed
          console.log('Auto-location verification failed:', error);
        }
      }
    };

    if (locationSettings && user?.employee_id) {
      autoVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationSettings, employeeLocation, user?.employee_id]);

  // Note: Camera is now managed by MultiAngleFaceCapture component

  const loadLocationSettings = async () => {
    if (!user?.company_id) return;
    try {
      const settings = await attendanceLocationService.getByCompany(user.company_id);
      setLocationSettings(settings);
    } catch (error) {
      console.error('Error loading location settings:', error);
      toast.error(t('employeeAttendance.failedToLoadLocationSettings'));
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

  const loadTodayAttendance = async () => {
    if (!user?.employee_id) return;
    try {
      setLoadingTodayAttendance(true);
      // Fetch only today's attendance records (aggregated)
      const logs = await attendanceService.getByEmployee(user.employee_id, 'today');
      const today = new Date().toISOString().split('T')[0];
      const todayLog = logs.find(log => log.date === today);
      setTodayAttendance(todayLog || null);
      
      // Also fetch raw records to determine shift state
      await loadTodayRawRecords();
    } catch (error) {
      console.error('Error loading today attendance:', error);
    } finally {
      setLoadingTodayAttendance(false);
    }
  };

  const loadTodayRawRecords = async () => {
    if (!user?.employee_id) return;
    try {
      // Get integer employee ID
      const employees = await employeeService.getAll();
      const employee = employees.find(e => e.id === user.employee_id);
      if (!employee) return;
      
      let integerEmployeeId: number | null = null;
      const externalId = (employee as any).external_id;
      if (externalId && !isNaN(Number(externalId))) {
        integerEmployeeId = Number(externalId);
      } else {
        const employeeIdText = employee.employee_id || employee.employeeId || '';
        const match = employeeIdText.match(/\d+/);
        if (match) {
          integerEmployeeId = parseInt(match[0], 10);
        } else if (!isNaN(Number(employeeIdText))) {
          integerEmployeeId = Number(employeeIdText);
        }
      }
      
      if (!integerEmployeeId) return;
      
      // Get today's date range
      const today = new Date();
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      
      const startISO = todayStart.toISOString();
      const endISO = todayEnd.toISOString();
      
      // Fetch raw records for today
      const response = await adminApi.get<any[]>(
        `/attendances?employee_id=eq.${integerEmployeeId}&timestamp=gte.${startISO}&select=*&order=timestamp.asc`
      );
      
      let rawRecords = response.data || [];
      // Filter end date on client side
      rawRecords = rawRecords.filter((raw: any) => {
        const recordDate = new Date(raw.timestamp);
        return recordDate <= new Date(endISO);
      });
      
      setTodayRawRecords(rawRecords);
      
      // Determine current shift state based on raw records
      await determineShiftState(rawRecords);
    } catch (error) {
      console.error('Error loading today raw records:', error);
    }
  };

  const determineShiftState = async (records: any[]) => {
    if (records.length === 0) {
      setCurrentShiftState('none');
      setHasMultipleShifts(false);
      return;
    }
    
    // Sort by timestamp
    const sortedRecords = [...records].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Get the last record
    const lastRecord = sortedRecords[sortedRecords.length - 1];
    
    // Determine state based on last record
    if (lastRecord.status1 === true) {
      // Last action was check-in
      setCurrentShiftState('checked_in');
    } else if (lastRecord.status2 === true) {
      // Last action was check-out
      setCurrentShiftState('checked_out');
    } else {
      // Fallback: use time of day
      const hour = new Date(lastRecord.timestamp).getHours();
      if (hour < 12) {
        setCurrentShiftState('checked_in');
      } else {
        setCurrentShiftState('checked_out');
      }
    }
    
    // Group entries by time to detect shifts
    // A shift is determined by time windows: entries close together in time belong to same shift
    // Entries far apart in time indicate different shifts
    const shifts: Array<{ checkIns: any[]; checkOuts: any[] }> = [];
    let currentShift: { checkIns: any[]; checkOuts: any[] } | null = null;
    
    sortedRecords.forEach((record, index) => {
      const isCheckIn = record.status1 === true;
      const isCheckOut = record.status2 === true;
      const recordTime = new Date(record.timestamp).getTime();
      
      if (isCheckIn) {
        // Check if this check-in starts a new shift
        // A new shift starts if:
        // 1. No current shift exists
        // 2. Previous shift has a check-out AND this check-in is more than 2 hours after the last check-out
        // 3. Previous shift has only check-ins AND this check-in is more than 4 hours after the last check-in
        if (!currentShift) {
          // Start first shift
          currentShift = { checkIns: [record], checkOuts: [] };
          shifts.push(currentShift);
        } else {
          // Check if this should start a new shift
          const lastCheckOut = currentShift.checkOuts[currentShift.checkOuts.length - 1];
          const lastCheckIn = currentShift.checkIns[currentShift.checkIns.length - 1];
          
          if (lastCheckOut) {
            // Previous shift has check-out - new shift if more than 2 hours gap
            const lastCheckOutTime = new Date(lastCheckOut.timestamp).getTime();
            const hoursGap = (recordTime - lastCheckOutTime) / (1000 * 60 * 60);
            if (hoursGap > 2) {
              // New shift
              currentShift = { checkIns: [record], checkOuts: [] };
              shifts.push(currentShift);
            } else {
              // Same shift - add check-in
              currentShift.checkIns.push(record);
            }
          } else {
            // Previous shift has no check-out yet - check time gap
            const lastCheckInTime = new Date(lastCheckIn.timestamp).getTime();
            const hoursGap = (recordTime - lastCheckInTime) / (1000 * 60 * 60);
            if (hoursGap > 4) {
              // New shift (likely a different shift time)
              currentShift = { checkIns: [record], checkOuts: [] };
              shifts.push(currentShift);
            } else {
              // Same shift - add check-in (might be duplicate/retry)
              currentShift.checkIns.push(record);
            }
          }
        }
      } else if (isCheckOut && currentShift) {
        // Add check-out to current shift
        currentShift.checkOuts.push(record);
      }
    });
    
    // Count completed and active shifts
    const completedShifts = shifts.filter(s => s.checkOuts.length > 0).length;
    const activeShifts = shifts.filter(s => s.checkOuts.length === 0 && s.checkIns.length > 0).length;
    const totalShifts = completedShifts + activeShifts;
    
    // Log for debugging
    console.log('Shift Detection:', {
      totalRecords: sortedRecords.length,
      shiftsDetected: totalShifts,
      completedShifts,
      activeShifts,
      shifts: shifts.map((s, i) => ({
        shift: i + 1,
        checkIns: s.checkIns.length,
        checkOuts: s.checkOuts.length,
        firstCheckIn: s.checkIns[0]?.timestamp,
        lastCheckIn: s.checkIns[s.checkIns.length - 1]?.timestamp,
        lastCheckOut: s.checkOuts[s.checkOuts.length - 1]?.timestamp
      })),
      currentState: currentShiftState
    });
    
    setHasMultipleShifts(totalShifts > 1);
  };

  const checkMultipleShifts = async () => {
    if (!user?.employee_id) return;
    try {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const shifts = await companySettingsService.getEmployeeShifts(user.employee_id, dayOfWeek);
      setHasMultipleShifts(shifts && shifts.length > 1);
    } catch (error) {
      console.error('Error checking multiple shifts:', error);
      setHasMultipleShifts(false);
    }
  };

  const getCurrentLocation = (): Promise<{ lat: number; lon: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error(t('employeeAttendance.geolocationNotSupported')));
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
          let errorMessage = '';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = t('employeeAttendance.locationAccessDenied');
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = t('employeeAttendance.locationUnavailable');
              break;
            case error.TIMEOUT:
              errorMessage = t('employeeAttendance.locationRequestTimeout');
              break;
            default:
              errorMessage = t('employeeAttendance.locationUnknownError');
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
        toast.error(t('employeeAttendance.attendanceLocationNotConfigured'));
        return;
      }

      // Show loading state
      toast.loading(t('employeeAttendance.gettingLocation'), { id: 'location-verification' });

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
        toast.error(t('employeeAttendance.locationTooFar', { distance: verification.distance.toFixed(0) }), {
          duration: 5000
        });
      } else {
        toast.success(t('employeeAttendance.locationVerifiedSuccess'), {
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
        toast.error(t('employeeAttendance.locationRequestTimeout'), {
          duration: 6000
        });
      } else {
        toast.error(t('employeeAttendance.locationError'), {
          duration: 6000
        });
      }
    }
  };


  const handleWebAuthnRegister = async () => {
    if (!user?.employee_id || !employeeData) {
      toast.error(t('employeeAttendance.employeeDataNotAvailable'));
      return;
    }

    if (!webauthnService.isSupported()) {
      toast.error(t('employeeAttendance.webauthnNotSupportedBrowser'));
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

      toast.success(t('employeeAttendance.deviceRegisteredSuccessMessage'));
      await checkWebAuthnCredential();
    } catch (error: any) {
      console.error('WebAuthn registration error:', error);
      toast.error(error.message || t('employeeAttendance.failedToRegisterDevice'));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleWebAuthnAuthenticate = async () => {
    if (!user?.employee_id) {
      toast.error(t('employeeAttendance.employeeIdNotFound'));
      return;
    }

    if (!webauthnService.isSupported()) {
      toast.error(t('employeeAttendance.webauthnNotSupportedBrowser'));
      return;
    }

    try {
      setIsAuthenticating(true);
      
      // Authenticate with WebAuthn
      const assertion = await webauthnService.authenticate(user.employee_id);

      // Verify authentication
      const result = await webauthnService.verifyAuthentication(
        user.employee_id,
        assertion
      );

      if (result.verified) {
        setWebauthnVerified(true);
        toast.success(t('employeeAttendance.webauthnVerificationSuccessful'));
      } else {
        toast.error(t('employeeAttendance.webauthnVerificationFailed'));
      }
    } catch (error: any) {
      console.error('WebAuthn authentication error:', error);
      toast.error(error.message || t('employeeAttendance.webauthnAuthenticationFailed'));
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
      toast.error(t('employeeAttendance.failedToLoadAttendanceLogs'));
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
      toast.error(t('employeeAttendance.employeeIdNotFound'));
      return;
    }

    // Determine which location settings to use
    const activeSettings = employeeLocation && !employeeLocation.use_company_default && employeeLocation.is_active
      ? { ...locationSettings, latitude: employeeLocation.latitude, longitude: employeeLocation.longitude, radius_meters: employeeLocation.radius_meters, is_active: employeeLocation.is_active }
      : locationSettings;

    // Verify location if required - auto-verify if not already verified
    if (activeSettings?.is_active) {
      if (!locationVerified) {
        // Try to verify location automatically
        try {
          await verifyLocation();
          // Wait a moment for state to update
          await new Promise(resolve => setTimeout(resolve, 500));
          // Check again after verification attempt
          if (!locationVerified) {
            toast.error(t('employeeAttendance.pleaseVerifyLocation'));
            return;
          }
        } catch (error) {
          toast.error(t('employeeAttendance.pleaseVerifyLocation'));
          return;
        }
      }
    }

    // Verify WebAuthn if required - directly prompt for authentication
    if (locationSettings?.require_face_verification) {
      if (!hasWebAuthnCredential) {
        toast.error(t('employeeAttendance.pleaseRegisterDevice'));
        return;
      }
      
      // Directly authenticate with WebAuthn when clicking check-in/check-out
      if (!webauthnVerified) {
        try {
          setIsAuthenticating(true);
          const assertion = await webauthnService.authenticate(user.employee_id);
          const result = await webauthnService.verifyAuthentication(user.employee_id, assertion);
          
          if (!result.verified) {
            toast.error(t('employeeAttendance.webauthnVerificationFailed'));
            setIsAuthenticating(false);
            return;
          }
          
          setWebauthnVerified(true);
          toast.success(t('employeeAttendance.webauthnVerificationSuccessful'));
        } catch (error: any) {
          console.error('WebAuthn authentication error:', error);
          toast.error(error.message || t('employeeAttendance.webauthnAuthenticationFailed'));
          setIsAuthenticating(false);
          return;
        } finally {
          setIsAuthenticating(false);
        }
      }
    }

    try {
      setIsSubmitting(true);
      setPunchType(type);

      const now = new Date();
      const date = now.toISOString().split('T')[0];
      // Add 3 hours to convert from Kuwait time (UTC+3) to UTC for storage
      // When user punches at 11:41 AM Kuwait time, we want to store it as 11:41 AM UTC
      // So we add 3 hours to the current time before converting to ISO
      const kuwaitTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
      const time = kuwaitTime.toISOString();

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

      toast.success(type === 'check_in' ? t('employeeAttendance.checkInRecorded') : t('employeeAttendance.checkOutRecorded'));
      
      // Reload today's attendance and raw records to update button states
      await loadTodayAttendance();
      await loadTodayRawRecords();
      
      // Reset states
      setLocationVerified(false);
      setWebauthnVerified(false);
      setUserLocation(null);
      setDistance(null);
    } catch (error: any) {
      console.error('Error submitting attendance:', error);
      toast.error(error.message || t('employeeAttendance.failedToMarkAttendance'));
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
        <p className="text-muted-foreground">{t('employeeAttendance.locationNotConfigured')}</p>
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
            {t('employeeAttendance.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-500/10 dark:bg-blue-500/10 border border-blue-500/30 dark:border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={18} className="text-blue-400" />
                <span className="font-semibold">
                  {activeLocation?.location_name || locationSettings?.location_name || t('employeeAttendance.location')}
                  {employeeLocation && !employeeLocation.use_company_default && (
                    <Badge variant="outline" className="ml-2 text-xs">{t('employeeAttendance.adminSet')}</Badge>
                  )}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('employeeAttendance.allowedRadius')}: {activeLocation?.radius_meters || locationSettings?.radius_meters || 100}{t('employeeAttendance.meters')}
                {employeeLocation?.use_company_default ? (
                  <span className="ml-2">({t('employeeAttendance.usingCompanyDefault')})</span>
                ) : employeeLocation ? (
                  <span className="ml-2">({t('employeeAttendance.setByAdministrator')})</span>
                ) : null}
              </p>
            </div>

            {/* Location Verification - Auto-verified, show status only */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={20} className="text-primary" />
                  <span className="font-semibold">{t('employeeAttendance.locationVerification')}</span>
                </div>
                {locationVerified ? (
                  <Badge variant="success" className="flex items-center gap-1">
                    <CheckCircle size={14} />
                    {t('employeeAttendance.verified')}
                  </Badge>
                ) : (
                  <Badge variant="outline">{t('employeeAttendance.notVerified')}</Badge>
                )}
              </div>
              
              {userLocation && (
                <div className="text-sm text-muted-foreground">
                  {t('employeeAttendance.yourLocation')}: {userLocation.lat.toFixed(6)}, {userLocation.lon.toFixed(6)}
                  {distance !== null && (
                    <span className="ml-2">
                      • {t('employeeAttendance.distance')}: {distance.toFixed(0)}{t('employeeAttendance.meters')}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* WebAuthn Verification - Only show register button for first-time users */}
            {locationSettings?.require_face_verification && (
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-purple-400" />
                    <span className="font-semibold">{t('employeeAttendance.biometricVerification')}</span>
                  </div>
                  {hasWebAuthnCredential ? (
                    <Badge variant="outline">{t('employeeAttendance.ready')}</Badge>
                  ) : (
                    <Badge variant="warning">{t('employeeAttendance.setupRequired')}</Badge>
                  )}
                </div>

                {!hasWebAuthnCredential && (
                  <>
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-sm text-yellow-400 mb-2">
                        {t('employeeAttendance.registerDeviceDescription')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('employeeAttendance.biometricDataPrivacy')}
                      </p>
                    </div>
                    <Button
                      onClick={handleWebAuthnRegister}
                      variant="outline"
                      className="w-full"
                      disabled={isSubmitting || isRegistering || !webauthnService.isSupported()}
                    >
                      {isRegistering ? (
                        <>
                          <Loader2 size={18} className="mr-2 animate-spin" />
                          {t('employeeAttendance.registering')}
                        </>
                      ) : (
                        <>
                          <CheckCircle size={18} className="mr-2" />
                          {t('employeeAttendance.registerDeviceButton')}
                        </>
                      )}
                    </Button>
                  </>
                )}
                {hasWebAuthnCredential && (
                  <p className="text-xs text-muted-foreground text-center">
                    {t('employeeAttendance.biometricWillPromptOnCheckIn')}
                  </p>
                )}
              </div>
            )}

            {/* Attendance Buttons */}
            <div className="pt-4 border-t border-border space-y-3">
              {(() => {
                // Determine button states based on current shift state from raw records
                // If no raw records, fall back to aggregated attendance
                let canCheckIn = false;
                let canCheckOut = false;
                
                if (todayRawRecords.length === 0) {
                  // No records today - can check in
                  canCheckIn = true;
                  canCheckOut = false;
                } else {
                  // Use shift state determined from raw records
                  if (currentShiftState === 'none' || currentShiftState === 'checked_out') {
                    // Not checked in or last action was check-out - can check in
                    canCheckIn = true;
                    canCheckOut = false;
                  } else if (currentShiftState === 'checked_in') {
                    // Currently checked in - can check out
                    canCheckIn = false;
                    canCheckOut = true;
                  }
                }

                return (
                  <>
                    <Button
                      onClick={() => submitAttendance('check_in')}
                      disabled={
                        !canCheckIn ||
                        isSubmitting ||
                        isAuthenticating ||
                        (locationSettings?.require_face_verification && !hasWebAuthnCredential) ||
                        loadingTodayAttendance
                      }
                      className="w-full"
                      size="lg"
                    >
                      {isSubmitting && punchType === 'check_in' ? (
                        <>
                          <Loader2 size={20} className="mr-2 animate-spin" />
                          {t('employeeAttendance.recordingCheckIn')}
                        </>
                      ) : isAuthenticating ? (
                        <>
                          <Loader2 size={20} className="mr-2 animate-spin" />
                          {t('employeeAttendance.verifying')}
                        </>
                      ) : (
                        <>
                          <CheckCircle size={20} className="mr-2" />
                          {t('employeeAttendance.checkIn')}
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => submitAttendance('check_out')}
                      disabled={
                        !canCheckOut ||
                        isSubmitting ||
                        isAuthenticating ||
                        (locationSettings?.require_face_verification && !hasWebAuthnCredential) ||
                        loadingTodayAttendance
                      }
                      variant="outline"
                      className="w-full"
                      size="lg"
                    >
                      {isSubmitting && punchType === 'check_out' ? (
                        <>
                          <Loader2 size={20} className="mr-2 animate-spin" />
                          {t('employeeAttendance.recordingCheckOut')}
                        </>
                      ) : isAuthenticating ? (
                        <>
                          <Loader2 size={20} className="mr-2 animate-spin" />
                          {t('employeeAttendance.verifying')}
                        </>
                      ) : (
                        <>
                          <XCircle size={20} className="mr-2" />
                          {t('employeeAttendance.checkOut')}
                        </>
                      )}
                    </Button>
                  </>
                );
              })()}

              <Button
                onClick={openAttendanceLogs}
                variant="outline"
                className="w-full"
              >
                <History size={18} className="mr-2" />
                {t('employeeAttendance.viewAttendanceHistory')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Logs Modal */}
      <Modal
        isOpen={isAttendanceLogModalOpen}
        onClose={() => setIsAttendanceLogModalOpen(false)}
        title={t('employeeAttendance.attendanceHistory')}
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
              <p className="text-muted-foreground">{t('employeeAttendance.noAttendanceRecords')}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {attendanceLogs.map((log) => (
                <Card key={log.id} className="border-border">
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
                        <div className="p-3 rounded-lg bg-green-500/10 dark:bg-green-500/10 border border-green-500/30 dark:border-green-500/20">
                          <div className="text-xs text-muted-foreground mb-1">{t('employeeAttendance.checkInLabel')}</div>
                          <div className="font-semibold text-green-600 dark:text-green-400">
                            {new Date(log.check_in).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      )}
                      {log.check_out && (
                        <div className="p-3 rounded-lg bg-red-500/10 dark:bg-red-500/10 border border-red-500/30 dark:border-red-500/20">
                          <div className="text-xs text-muted-foreground mb-1">{t('employeeAttendance.checkOutLabel')}</div>
                          <div className="font-semibold text-red-600 dark:text-red-400">
                            {new Date(log.check_out).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {(log.late_minutes > 0 || log.overtime_minutes > 0) && (
                      <div className="flex gap-4 mt-3 pt-3 border-t border-border">
                        {log.late_minutes > 0 && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t('employeeAttendance.lateLabel')}: </span>
                            <span className="font-semibold text-orange-400">{log.late_minutes} {t('common.minutes')}</span>
                          </div>
                        )}
                        {log.overtime_minutes > 0 && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t('employeeAttendance.overtimeLabel')}: </span>
                            <span className="font-semibold text-blue-400">{log.overtime_minutes} {t('common.minutes')}</span>
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

