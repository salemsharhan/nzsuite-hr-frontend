import { adminApi } from './api';
import { attendanceLocationService, EmployeeFaceImage } from './attendanceLocationService';

// Face recognition using Web API (MediaDevices) and image comparison
// For production, integrate with a face recognition service or use face-api.js
// This is a simplified implementation that captures and stores face images
// Face matching can be done server-side or with a proper face recognition library

let faceRecognitionAvailable = false;

/**
 * Check if face recognition is available
 */
async function checkFaceRecognitionAvailability(): Promise<boolean> {
  try {
    // Check if camera is available
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    faceRecognitionAvailable = true;
    return true;
  } catch (error) {
    console.error('Face recognition not available:', error);
    return false;
  }
}

/**
 * Capture face from video stream
 * Returns base64 encoded image
 */
export async function captureFaceFromVideo(
  videoElement: HTMLVideoElement
): Promise<string | null> {
  try {
    if (!videoElement.videoWidth || !videoElement.videoHeight) {
      throw new Error('Video not ready');
    }

    // Create canvas and draw video frame
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Convert canvas to base64 image
    // In production, you would detect face here using face-api.js or similar
    // For now, we'll just capture the image and do basic validation
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Basic validation: check if image is not empty
    if (!imageData || imageData.length < 100) {
      throw new Error('Failed to capture image');
    }

    return imageData;
  } catch (error) {
    console.error('Error capturing face:', error);
    return null;
  }
}

/**
 * Get face descriptor from image
 * For now, returns a simplified descriptor based on image hash
 * In production, use face-api.js or a proper face recognition service
 */
export async function getFaceDescriptor(imageData: string): Promise<Float32Array | null> {
  try {
    // Simplified implementation - in production, use face-api.js
    // This creates a basic descriptor for demonstration
    // For real face recognition, integrate face-api.js or use a service
    
    const img = new Image();
    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          // Create a canvas to process the image
          const canvas = document.createElement('canvas');
          canvas.width = 128;
          canvas.height = 128;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, 128, 128);
          const imageData = ctx.getImageData(0, 0, 128, 128);
          const data = imageData.data;

          // Create a simplified descriptor (128 features)
          // In production, use face-api.js descriptor which has 128 features
          const descriptor = new Float32Array(128);
          for (let i = 0; i < 128; i++) {
            // Simplified feature extraction - in production use proper face recognition
            const pixelIndex = (i * 4) % (data.length / 4);
            descriptor[i] = (data[pixelIndex * 4] + data[pixelIndex * 4 + 1] + data[pixelIndex * 4 + 2]) / 765.0;
          }

          resolve(descriptor);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageData;
    });
  } catch (error) {
    console.error('Error getting face descriptor:', error);
    return null;
  }
}

/**
 * Compare two face descriptors
 */
export function compareFaces(
  descriptor1: Float32Array,
  descriptor2: Float32Array
): number {
  // Calculate Euclidean distance between descriptors
  let distance = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    distance += diff * diff;
  }
  distance = Math.sqrt(distance);

  // Convert distance to confidence score (0-100)
  // Lower distance = higher confidence
  // Typical threshold: < 0.6 = match, > 0.6 = no match
  const threshold = 0.6;
  const confidence = Math.max(0, Math.min(100, (1 - distance / threshold) * 100));
  
  return confidence;
}

export const faceRecognitionService = {
  /**
   * Get primary face image for an employee
   */
  async getPrimaryFaceImage(employeeId: string): Promise<EmployeeFaceImage | null> {
    try {
      const response = await adminApi.get<EmployeeFaceImage[]>(
        `/employee_face_images?employee_id=eq.${employeeId}&is_primary=eq.true&limit=1`
      );
      return response.data && response.data.length > 0 ? response.data[0] : null;
    } catch (error) {
      console.error('Error fetching face image:', error);
      return null;
    }
  },

  /**
   * Save face image for an employee
   */
  async saveFaceImage(
    employeeId: string,
    imageData: string,
    faceEncoding?: string
  ): Promise<EmployeeFaceImage> {
    try {
      // Upload image to Supabase Storage
      // For now, we'll store as base64 in the database
      // In production, upload to Supabase Storage and store URL
      
      const response = await adminApi.post<EmployeeFaceImage>(
        '/employee_face_images',
        {
          employee_id: employeeId,
          face_image_url: imageData, // In production, use Storage URL
          face_encoding: faceEncoding || null,
          is_primary: true,
          captured_at: new Date().toISOString(),
          captured_via: 'web',
          device_info: navigator.userAgent,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error saving face image:', error);
      throw error;
    }
  },

  /**
   * Verify face against stored face image
   */
  async verifyFace(
    employeeId: string,
    capturedImageData: string
  ): Promise<{ verified: boolean; confidence: number }> {
    try {
      // Get stored face image
      const storedFace = await this.getPrimaryFaceImage(employeeId);
      
      if (!storedFace) {
        return { verified: false, confidence: 0 };
      }

      // Get descriptors for both images
      const capturedDescriptor = await getFaceDescriptor(capturedImageData);
      if (!capturedDescriptor) {
        return { verified: false, confidence: 0 };
      }

      // If stored face has encoding, compare directly
      if (storedFace.face_encoding) {
        try {
          const storedDescriptor = new Float32Array(JSON.parse(storedFace.face_encoding));
          const confidence = compareFaces(capturedDescriptor, storedDescriptor);
          return {
            verified: confidence >= 70, // 70% confidence threshold
            confidence
          };
        } catch (error) {
          console.error('Error parsing stored face encoding:', error);
        }
      }

      // Fallback: compare with stored image
      if (storedFace.face_image_url && storedFace.face_image_url !== null) {
        const storedDescriptor = await getFaceDescriptor(storedFace.face_image_url);
        if (!storedDescriptor) {
          return { verified: false, confidence: 0 };
        }

        const confidence = compareFaces(capturedDescriptor, storedDescriptor);
        return {
          verified: confidence >= 70,
          confidence
        };
      }

      return { verified: false, confidence: 0 };
    } catch (error) {
      console.error('Error verifying face:', error);
      return { verified: false, confidence: 0 };
    }
  },

  /**
   * Capture and save face image (first time setup)
   */
  async captureAndSaveFace(
    employeeId: string,
    videoElement: HTMLVideoElement
  ): Promise<{ success: boolean; imageData?: string; error?: string }> {
    try {
      const imageData = await captureFaceFromVideo(videoElement);
      if (!imageData) {
        return { success: false, error: 'No face detected' };
      }

      // Get face descriptor for future recognition
      const descriptor = await getFaceDescriptor(imageData);
      const encoding = descriptor ? JSON.stringify(Array.from(descriptor)) : undefined;

      // Save face image
      await this.saveFaceImage(employeeId, imageData, encoding);

      return { success: true, imageData };
    } catch (error: any) {
      console.error('Error capturing and saving face:', error);
      return { success: false, error: error.message || 'Failed to capture face' };
    }
  }
};

