import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle, XCircle, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, User, Loader2 } from 'lucide-react';
import { Button, Badge } from '../common/UIComponents';
import { faceRecognitionService, FaceAngle, captureFaceFromVideo } from '../../services/faceRecognitionService';
import { toast } from 'sonner';

interface MultiAngleFaceCaptureProps {
  employeeId: string;
  onComplete: () => void;
  onCancel: () => void;
  isVerification?: boolean; // If true, only verify (don't capture multiple angles)
}

const ANGLES: Array<{ angle: FaceAngle; label: string; icon: React.ReactNode; instruction: string }> = [
  { angle: 'front', label: 'Front', icon: <User size={24} />, instruction: 'Look straight at the camera' },
  { angle: 'left', label: 'Left', icon: <ArrowLeft size={24} />, instruction: 'Turn your head to the left' },
  { angle: 'right', label: 'Right', icon: <ArrowRight size={24} />, instruction: 'Turn your head to the right' },
  { angle: 'up', label: 'Up', icon: <ArrowUp size={24} />, instruction: 'Look up slightly' },
  { angle: 'down', label: 'Down', icon: <ArrowDown size={24} />, instruction: 'Look down slightly' }
];

export default function MultiAngleFaceCapture({ 
  employeeId, 
  onComplete, 
  onCancel,
  isVerification = false 
}: MultiAngleFaceCaptureProps) {
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  const [capturedAngles, setCapturedAngles] = useState<Set<FaceAngle>>(new Set());
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);

  const currentAngle = isVerification ? 'front' : ANGLES[currentAngleIndex].angle;
  const isLastAngle = isVerification || currentAngleIndex === ANGLES.length - 1;
  const allAnglesCaptured = isVerification || capturedAngles.size === ANGLES.length;

  // Debug: Log when cameraReady changes
  useEffect(() => {
    console.log(`[MultiAngleFaceCapture] cameraReady state changed to: ${cameraReady}`);
  }, [cameraReady]);

  // Debug: Log when modelsLoading changes and auto-fix if needed
  useEffect(() => {
    console.log(`[MultiAngleFaceCapture] modelsLoading state changed to: ${modelsLoading}`);
    const actuallyLoaded = faceRecognitionService.areModelsLoadedSync();
    if (modelsLoading && actuallyLoaded) {
      console.log('[MultiAngleFaceCapture] ⚠️ modelsLoading is true but models are actually loaded! Fixing...');
      setModelsLoading(false);
    }
  }, [modelsLoading]);

  useEffect(() => {
    console.log('[MultiAngleFaceCapture] Component mounted, initializing...');
    // Load face-api.js models
    loadModels();
    startCamera();

    return () => {
      console.log('[MultiAngleFaceCapture] Component unmounting, cleaning up...');
      // Clear any model checking intervals
      if ((window as any).__faceModelCheckInterval) {
        clearInterval((window as any).__faceModelCheckInterval);
        (window as any).__faceModelCheckInterval = null;
      }
      stopCamera();
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Restart camera when angle changes
    if (!isVerification && currentAngleIndex > 0) {
      console.log(`[MultiAngleFaceCapture] Angle changed to index ${currentAngleIndex}, restarting camera...`);
      stopCamera();
      setTimeout(() => {
        startCamera();
      }, 300);
    }
  }, [currentAngleIndex, isVerification]);

  const loadModels = async () => {
    try {
      setModelsLoading(true);
      console.log('[MultiAngleFaceCapture] Checking if models are loaded...');
      
      // First check synchronously if already loaded
      if (faceRecognitionService.areModelsLoadedSync()) {
        console.log('[MultiAngleFaceCapture] Models are already loaded (sync check)');
        setModelsLoading(false);
        return;
      }
      
      // Trigger model loading (this will load them if not already loading)
      console.log('[MultiAngleFaceCapture] Models not loaded, triggering load...');
      
      // Use a timeout to ensure we don't wait forever
      const loadPromise = faceRecognitionService.areModelsLoaded();
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          console.log('[MultiAngleFaceCapture] Model load timeout, will poll instead');
          resolve(false);
        }, 5000); // 5 second timeout
      });
      
      const loaded = await Promise.race([loadPromise, timeoutPromise]);
      console.log(`[MultiAngleFaceCapture] Models loaded check result: ${loaded}`);
      
      if (loaded) {
        console.log('[MultiAngleFaceCapture] ✓ Models loaded successfully!');
        setModelsLoading(false);
        return;
      }
      
      console.log('[MultiAngleFaceCapture] Models still loading, polling for completion...');
      toast.warning('Face recognition models are loading. Please wait...');
      
      // Poll for models to be loaded (they're loading in the background)
      let retryCount = 0;
      const maxRetries = 60; // 60 * 500ms = 30 seconds max wait
      
      const checkModels = setInterval(() => {
        retryCount++;
        const isLoaded = faceRecognitionService.areModelsLoadedSync();
        
        if (retryCount % 10 === 0 || isLoaded) { // Log every 10th check or when loaded
          console.log(`[MultiAngleFaceCapture] Model check attempt #${retryCount}: ${isLoaded}`);
        }
        
        if (isLoaded) {
          console.log('[MultiAngleFaceCapture] ✓ Models loaded successfully!');
          clearInterval(checkModels);
          setModelsLoading(false);
          toast.success('Face recognition models loaded successfully');
        } else if (retryCount >= maxRetries) {
          console.error('[MultiAngleFaceCapture] Models failed to load after max retries');
          clearInterval(checkModels);
          setModelsLoading(false);
          toast.error('Failed to load face recognition models. Please refresh the page.');
        }
      }, 500); // Check every 500ms
      
      // Store interval ref so we can clear it on unmount
      return () => {
        clearInterval(checkModels);
      };
      
    } catch (error) {
      console.error('[MultiAngleFaceCapture] Error loading models:', error);
      toast.error('Failed to load face recognition models');
      setModelsLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      console.log('[MultiAngleFaceCapture] Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      console.log('[MultiAngleFaceCapture] Camera stream obtained');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        console.log('[MultiAngleFaceCapture] Stream assigned to video element');

        // Set up multiple event listeners to catch when video is ready
        const checkVideoReady = () => {
          if (videoRef.current) {
            const width = videoRef.current.videoWidth;
            const height = videoRef.current.videoHeight;
            const readyState = videoRef.current.readyState;
            const paused = videoRef.current.paused;
            
            console.log(`[MultiAngleFaceCapture] Video check - width: ${width}, height: ${height}, readyState: ${readyState}, paused: ${paused}`);
            
            if (width > 0 && height > 0 && readyState >= 2 && !paused) {
              console.log('[MultiAngleFaceCapture] ✓ Video is ready! Setting cameraReady to true');
              setCameraReady(true);
              // Start detection immediately if not already started
              if (!detectionIntervalRef.current) {
                console.log('[MultiAngleFaceCapture] Starting face detection...');
                startFaceDetection();
              }
              return true;
            }
          }
          return false;
        };

        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          console.log('[MultiAngleFaceCapture] onloadedmetadata event fired');
          if (videoRef.current) {
            console.log(`[MultiAngleFaceCapture] Video dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
            if (!checkVideoReady()) {
              // If not ready yet, try to play
              videoRef.current.play().then(() => {
                console.log('[MultiAngleFaceCapture] Video play() promise resolved');
                setTimeout(() => {
                  checkVideoReady();
                }, 100);
              }).catch((error) => {
                console.error('[MultiAngleFaceCapture] Error playing video:', error);
              });
            }
          }
        };
        
        videoRef.current.oncanplay = () => {
          console.log('[MultiAngleFaceCapture] oncanplay event fired');
          checkVideoReady();
        };

        videoRef.current.oncanplaythrough = () => {
          console.log('[MultiAngleFaceCapture] oncanplaythrough event fired');
          checkVideoReady();
        };

        videoRef.current.onplay = () => {
          console.log('[MultiAngleFaceCapture] onplay event fired');
          setTimeout(() => {
            checkVideoReady();
          }, 100);
        };

        videoRef.current.onplaying = () => {
          console.log('[MultiAngleFaceCapture] onplaying event fired');
          checkVideoReady();
        };

        // Also try to play immediately and check periodically
        if (videoRef.current.readyState >= 2) {
          console.log('[MultiAngleFaceCapture] Video already has metadata, attempting to play...');
          videoRef.current.play().then(() => {
            setTimeout(() => {
              checkVideoReady();
            }, 200);
          });
        }

        // Fallback: check periodically if video becomes ready
        let checkCount = 0;
        const fallbackCheck = setInterval(() => {
          checkCount++;
          if (checkVideoReady() || checkCount > 20) {
            clearInterval(fallbackCheck);
          }
        }, 200);
      }
    } catch (error) {
      console.error('[MultiAngleFaceCapture] Error starting camera:', error);
      toast.error('Failed to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setCameraReady(false);
    setFaceDetected(false);
  };

  const startFaceDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    console.log('[MultiAngleFaceCapture] Starting face detection loop...');
    let detectionCount = 0;

    // Check for face every 300ms (more frequent for better responsiveness)
    detectionIntervalRef.current = window.setInterval(async () => {
      detectionCount++;
      
      if (!videoRef.current) {
        console.log(`[MultiAngleFaceCapture] Detection #${detectionCount}: No video ref`);
        return;
      }
      
      // Check video state directly and fix cameraReady if needed
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      const readyState = videoRef.current.readyState;
      const paused = videoRef.current.paused;
      
      // If video is actually ready but cameraReady state is false, update it
      if (videoWidth > 0 && videoHeight > 0 && readyState >= 2 && !paused && !cameraReady) {
        console.log(`[MultiAngleFaceCapture] Detection #${detectionCount}: Video is ready but cameraReady is false, fixing state...`);
        setCameraReady(true);
      }
      
      if (!cameraReady && (videoWidth === 0 || videoHeight === 0 || readyState < 2 || paused)) {
        if (detectionCount % 10 === 0) { // Log every 10th check to reduce spam
          console.log(`[MultiAngleFaceCapture] Detection #${detectionCount}: Camera not ready - width: ${videoWidth}, height: ${videoHeight}, readyState: ${readyState}, paused: ${paused}, cameraReady state: ${cameraReady}`);
        }
        return;
      }
      
      // Check models loading state - if models are actually loaded, fix the state
      const modelsActuallyLoaded = faceRecognitionService.areModelsLoadedSync();
      if (modelsLoading && modelsActuallyLoaded) {
        console.log(`[MultiAngleFaceCapture] Detection #${detectionCount}: Models are loaded but state says loading, fixing...`);
        setModelsLoading(false);
      }
      
      if (modelsLoading && !modelsActuallyLoaded) {
        if (detectionCount % 10 === 0) {
          console.log(`[MultiAngleFaceCapture] Detection #${detectionCount}: Models still loading (sync check: ${modelsActuallyLoaded})`);
        }
        return;
      }

      // Video state already checked above, use those values
      // Additional validation
      if (!videoWidth || !videoHeight) {
        if (detectionCount % 10 === 0) {
          console.log(`[MultiAngleFaceCapture] Detection #${detectionCount}: Video has no dimensions (${videoWidth}x${videoHeight})`);
        }
        return;
      }

      if (paused) {
        if (detectionCount % 10 === 0) {
          console.log(`[MultiAngleFaceCapture] Detection #${detectionCount}: Video is paused`);
        }
        return;
      }

      if (readyState < 2) {
        if (detectionCount % 10 === 0) {
          console.log(`[MultiAngleFaceCapture] Detection #${detectionCount}: Video readyState is ${readyState} (need >= 2)`);
        }
        return;
      }

      try {
        if (detectionCount % 5 === 0) { // Log every 5th detection attempt to reduce spam
          console.log(`[MultiAngleFaceCapture] Detection #${detectionCount}: Attempting face detection...`);
        }
        const result = await captureFaceFromVideo(videoRef.current);
        const wasDetected = result?.detected || false;
        if (wasDetected || detectionCount % 5 === 0) { // Always log when detected, or every 5th attempt
          console.log(`[MultiAngleFaceCapture] Detection #${detectionCount}: Result - detected=${wasDetected}`);
        }
        setFaceDetected(wasDetected);
      } catch (error) {
        // Log error for debugging but don't show to user
        console.error(`[MultiAngleFaceCapture] Detection #${detectionCount}: Error:`, error);
        setFaceDetected(false);
      }
    }, 300);
  };

  const captureCurrentAngle = async () => {
    if (!videoRef.current || !faceDetected || isCapturing) return;

    try {
      setIsCapturing(true);
      setIsProcessing(true);

      if (isVerification) {
        // Verification mode - just verify against stored faces
        const imageData = await captureFaceFromVideo(videoRef.current);
        if (!imageData || !imageData.detected) {
          toast.error('No face detected. Please ensure your face is clearly visible.');
          return;
        }

        const verification = await faceRecognitionService.verifyFace(
          employeeId,
          imageData.imageData
        );

        if (verification.verified) {
          toast.success(`Face verified! Confidence: ${verification.confidence.toFixed(1)}%`);
          onComplete();
        } else {
          toast.error(`Face verification failed. Confidence: ${verification.confidence.toFixed(1)}%`);
        }
      } else {
        // Registration mode - capture multiple angles
        const result = await faceRecognitionService.captureAndSaveFace(
          employeeId,
          videoRef.current,
          currentAngle
        );

        if (result.success) {
          setCapturedAngles(prev => new Set([...prev, currentAngle]));
          toast.success(`${ANGLES[currentAngleIndex].label} angle captured!`);

          // Move to next angle or complete
          if (isLastAngle) {
            // All angles captured
            toast.success('All face angles captured successfully!');
            onComplete();
          } else {
            // Move to next angle
            setCurrentAngleIndex(prev => prev + 1);
            setFaceDetected(false);
          }
        } else {
          toast.error(result.error || 'Failed to capture face');
        }
      }
    } catch (error: any) {
      console.error('Error capturing face:', error);
      toast.error(error.message || 'Failed to capture face');
    } finally {
      setIsCapturing(false);
      setIsProcessing(false);
    }
  };

  const handleNext = () => {
    if (currentAngleIndex < ANGLES.length - 1) {
      setCurrentAngleIndex(prev => prev + 1);
      setFaceDetected(false);
    }
  };

  const handlePrevious = () => {
    if (currentAngleIndex > 0) {
      setCurrentAngleIndex(prev => prev - 1);
      setFaceDetected(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pb-24">
      <div className="bg-card border border-white/20 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Camera size={28} className="text-primary" />
                {isVerification ? 'Face Verification' : 'Multi-Angle Face Registration'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isVerification 
                  ? 'Please look at the camera to verify your identity'
                  : 'Capture your face from multiple angles for better recognition'
                }
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <XCircle size={20} />
            </Button>
          </div>
        </div>

        {/* Progress Indicator */}
        {!isVerification && (
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Angle {currentAngleIndex + 1} of {ANGLES.length}
              </span>
              <span className="text-sm text-muted-foreground">
                {capturedAngles.size} / {ANGLES.length} captured
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentAngleIndex + 1) / ANGLES.length) * 100}%` }}
              />
            </div>
            <div className="flex gap-2 mt-3">
              {ANGLES.map((angle, idx) => (
                <div
                  key={angle.angle}
                  className={`flex-1 h-1 rounded ${
                    idx === currentAngleIndex
                      ? 'bg-primary'
                      : capturedAngles.has(angle.angle)
                      ? 'bg-green-500'
                      : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Camera View */}
        <div className="p-6">
          {modelsLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary mb-4" size={48} />
              <p className="text-muted-foreground">Loading face recognition models...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current Angle Info */}
              {!isVerification && (
                <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    {ANGLES[currentAngleIndex].icon}
                    <h3 className="text-lg font-semibold">
                      {ANGLES[currentAngleIndex].label} Angle
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {ANGLES[currentAngleIndex].instruction}
                  </p>
                </div>
              )}

              {/* Video Preview */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                
                {/* Face Detection Indicator */}
                <div className="absolute top-4 right-4">
                  {faceDetected ? (
                    <Badge variant="success" className="flex items-center gap-1">
                      <CheckCircle size={14} />
                      Face Detected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <XCircle size={14} />
                      No Face
                    </Badge>
                  )}
                </div>

                {/* Face Frame Guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-48 h-64 border-2 rounded-lg transition-all ${
                    faceDetected ? 'border-green-400' : 'border-yellow-400/50'
                  }`} />
                </div>
              </div>

              {/* Instructions */}
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-400">
                  {isVerification
                    ? 'Position your face within the frame and click "Verify Face" when ready.'
                    : 'Position your face within the frame. Make sure your face is clearly visible and well-lit.'
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-white/10 flex items-center justify-between gap-4 mt-auto sticky bottom-0 bg-card z-10">
          <div className="flex gap-2">
            {!isVerification && currentAngleIndex > 0 && (
              <Button variant="outline" onClick={handlePrevious} disabled={isCapturing}>
                Previous
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isCapturing}>
              Cancel
            </Button>
            <Button
              onClick={captureCurrentAngle}
              disabled={!cameraReady || !faceDetected || isCapturing || modelsLoading}
              className="min-w-[140px]"
            >
              {isCapturing || isProcessing ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  {isVerification ? 'Verifying...' : 'Capturing...'}
                </>
              ) : (
                <>
                  <Camera className="mr-2" size={16} />
                  {isVerification ? 'Verify Face' : 'Capture'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

