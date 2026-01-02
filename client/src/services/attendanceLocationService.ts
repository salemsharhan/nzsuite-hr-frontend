import { adminApi } from './api';

export interface AttendanceLocationSettings {
  id: string;
  company_id: string;
  location_name: string;
  google_maps_link: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  face_recognition_enabled: boolean;
  require_face_verification: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeFaceImage {
  id: string;
  employee_id: string;
  face_image_url: string;
  face_encoding: string | null;
  is_primary: boolean;
  captured_at: string;
  captured_via: string;
  device_info: string | null;
  created_at: string;
  updated_at: string;
}

export const attendanceLocationService = {
  /**
   * Get attendance location settings for a company
   */
  async getByCompany(companyId: string): Promise<AttendanceLocationSettings | null> {
    try {
      const response = await adminApi.get<AttendanceLocationSettings[]>(
        `/attendance_location_settings?company_id=eq.${companyId}&is_active=eq.true&limit=1`
      );
      return response.data && response.data.length > 0 ? response.data[0] : null;
    } catch (error) {
      console.error('Error fetching attendance location settings:', error);
      return null;
    }
  },

  /**
   * Create or update attendance location settings
   */
  async upsert(settings: Partial<AttendanceLocationSettings>): Promise<AttendanceLocationSettings> {
    try {
      // Check if settings exist for this company
      if (settings.company_id) {
        const existing = await this.getByCompany(settings.company_id);
        if (existing) {
          // Update existing
          const response = await adminApi.patch<AttendanceLocationSettings[]>(
            `/attendance_location_settings?id=eq.${existing.id}`,
            {
              ...settings,
              updated_at: new Date().toISOString()
            }
          );
          return response.data[0];
        }
      }
      
      // Create new
      const response = await adminApi.post<AttendanceLocationSettings>(
        '/attendance_location_settings',
        {
          ...settings,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error upserting attendance location settings:', error);
      throw error;
    }
  },

  /**
   * Extract coordinates from a Google Maps URL (internal helper)
   */
  extractCoordinatesFromUrl(url: string): { latitude: number; longitude: number } | null {
    // Format 1: https://www.google.com/maps?q=lat,lng
    let match = url.match(/[?&]q=([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/);
    if (match) {
      return {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2])
      };
    }

    // Format 2: https://www.google.com/maps/@lat,lng,zoom
    match = url.match(/@([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/);
    if (match) {
      return {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2])
      };
    }

    // Format 3: https://maps.google.com/?ll=lat,lng
    match = url.match(/[?&]ll=([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/);
    if (match) {
      return {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2])
      };
    }

    // Format 4: https://www.google.com/maps/place/.../@lat,lng
    match = url.match(/\/@([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/);
    if (match) {
      return {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2])
      };
    }

    // Format 5: https://www.google.com/maps/place/PlaceName/@lat,lng,zoom
    match = url.match(/place\/[^@]+@([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/);
    if (match) {
      return {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2])
      };
    }

    return null;
  },

  /**
   * Parse Google Maps link to extract coordinates
   * Supports various Google Maps URL formats including short links
   */
  async parseGoogleMapsLink(link: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // First, try to extract coordinates directly from the link
      const directResult = attendanceLocationService.extractCoordinatesFromUrl(link);
      if (directResult) {
        return directResult;
      }

      // Handle short Google Maps links (maps.app.goo.gl or goo.gl/maps)
      if (link.includes('maps.app.goo.gl') || link.includes('goo.gl/maps')) {
        // Short links need to be resolved to get the full URL
        // We'll try to fetch the redirect and extract coordinates from the final URL
        try {
          const response = await fetch(link, { 
            method: 'HEAD', 
            redirect: 'follow',
            mode: 'cors'
          });
          const finalUrl = response.url;
          
          // Try to parse the resolved URL
          const resolvedResult = attendanceLocationService.extractCoordinatesFromUrl(finalUrl);
          if (resolvedResult) {
            return resolvedResult;
          }
        } catch (error) {
          console.warn('Could not resolve short link:', error);
          // If CORS blocks the request, we can't resolve short links from the browser
          // In this case, suggest using the full Google Maps URL
          throw new Error('Short Google Maps links cannot be resolved due to browser restrictions. Please use a full Google Maps URL or share the location and copy the full URL from the address bar.');
        }
      }

      return null;
    } catch (error) {
      console.error('Error parsing Google Maps link:', error);
      throw error;
    }
  },

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  },

  toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  },

  /**
   * Verify if location is within allowed radius
   */
  verifyLocation(
    userLat: number,
    userLon: number,
    allowedLat: number,
    allowedLon: number,
    radiusMeters: number
  ): { verified: boolean; distance: number } {
    const distance = this.calculateDistance(userLat, userLon, allowedLat, allowedLon);
    return {
      verified: distance <= radiusMeters,
      distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
    };
  }
};

