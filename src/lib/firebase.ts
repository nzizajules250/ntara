import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, limit, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
export { doc, updateDoc };
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  if (error?.code === 'permission-denied') {
    const user = auth.currentUser;
    const errorInfo: FirestoreErrorInfo = {
      error: error.message,
      operationType,
      path,
      authInfo: {
        userId: user?.uid || 'unauthenticated',
        email: user?.email || '',
        emailVerified: user?.emailVerified || false,
        isAnonymous: user?.isAnonymous || false,
        providerInfo: user?.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName || '',
          email: p.email || '',
        })) || []
      }
    };
    throw new Error(JSON.stringify(errorInfo));
  }
  throw error;
}

export type UserRole = 'passenger' | 'rider';

export interface SavedLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  createdAt?: any;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  rating: number;
  totalTrips: number;
  avatarUrl?: string;
  isOnline?: boolean;
  status?: 'active' | 'inactive' | 'riding';
  badges?: string[];
  currentLocation?: { lat: number; lng: number };
  gender?: string;
  dob?: string;
  vehicleType?: 'car' | 'motorcycle';
  licenseClass?: string;
  vehicleModel?: string;
  numberPlate?: string;
  permitCardNumber?: string;
  availabilityRadius?: number;
  favoriteUserIds?: string[];
  savedLocations?: SavedLocation[];
  emergencyContact?: {
    name: string;
    phone: string;
  };
}

export type RideStatus = 'requested' | 'accepted' | 'arrived' | 'ongoing' | 'completed' | 'cancelled';
export type RatingReason = 'driving' | 'timing' | 'navigation';

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  isActive: boolean;
}

export interface Ride {
  id: string;
  passengerId: string;
  riderId?: string;
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  destination: {
    address: string;
    lat: number;
    lng: number;
  };
  status: RideStatus;
  fare: number;
  discountAmount?: number;
  promoCode?: string;
  cancellationReason?: string;
  riderRating?: number;
  ratingReason?: RatingReason;
  createdAt: any;
  updatedAt?: any;
  acceptedAt?: any;
  arrivedAt?: any;
  startedAt?: any;
  completedAt?: any;
  passengerConfirmedArrival?: boolean;
  passengerConfirmedStart?: boolean;
  passengerConfirmedEnd?: boolean;
  riderConfirmedEnd?: boolean;
  isOnTime?: boolean;
}

// User Profile Actions
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as UserProfile : null;
  } catch (error) {
    return handleFirestoreError(error, 'get', `users/${uid}`);
  }
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  try {
    await setDoc(doc(db, 'users', profile.uid), profile);
  } catch (error) {
    return handleFirestoreError(error, 'create', `users/${profile.uid}`);
  }
}

// Ride Actions
export async function createRideRequest(ride: Omit<Ride, 'id' | 'createdAt'>): Promise<string> {
  try {
    // Firestore does not accept undefined values. Filter them out.
    const cleanRide = Object.fromEntries(
      Object.entries(ride).filter(([_, v]) => v !== undefined)
    );
    const docRef = await addDoc(collection(db, 'rides'), {
      ...cleanRide,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    return handleFirestoreError(error, 'create', 'rides');
  }
}

export async function updateRideStatus(rideId: string, status: RideStatus, riderId?: string, cancellationReason?: string): Promise<void> {
  try {
    const updateData: any = { 
      status, 
      updatedAt: serverTimestamp() 
    };
    if (riderId) updateData.riderId = riderId;
    if (cancellationReason) updateData.cancellationReason = cancellationReason;
    
    await updateDoc(doc(db, 'rides', rideId), updateData);
  } catch (error) {
    return handleFirestoreError(error, 'update', `rides/${rideId}`);
  }
}

export async function rateRide(rideId: string, rating: number, reason: RatingReason): Promise<void> {
  try {
    await updateDoc(doc(db, 'rides', rideId), {
      riderRating: rating,
      ratingReason: reason,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    return handleFirestoreError(error, 'update', `rides/${rideId}`);
  }
}

export async function validatePromoCode(code: string): Promise<PromoCode | null> {
  try {
    const q = query(collection(db, 'promoCodes'), where('code', '==', code.toUpperCase()), where('isActive', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as PromoCode;
  } catch (error) {
    return handleFirestoreError(error, 'list', 'promoCodes');
  }
}

export async function updateUserLocation(uid: string, lat: number, lng: number): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      currentLocation: { lat, lng },
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    return handleFirestoreError(error, 'update', `users/${uid}`);
  }
}

// Map Helpers
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'SwiftRide-App-Build'
      }
    });
    if (!response.ok) throw new Error('Geocoding failed');
    const data = await response.json();
    return data.display_name || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  } catch (error) {
    console.error("Geocoding error", error);
    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}

// Subscriptions
export function subscribeToUserProfile(uid: string, callback: (profile: UserProfile) => void) {
  return onSnapshot(
    doc(db, 'users', uid), 
    (doc) => {
      if (doc.exists()) {
        callback({ uid: doc.id, ...doc.data() } as UserProfile);
      }
    },
    (error) => handleFirestoreError(error, 'get', `users/${uid}`)
  );
}

export function subscribeToActiveRide(rideId: string, callback: (ride: Ride) => void) {
  return onSnapshot(
    doc(db, 'rides', rideId), 
    (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() } as Ride);
      }
    },
    (error) => handleFirestoreError(error, 'get', `rides/${rideId}`)
  );
}

export function subscribeToAvailableRides(callback: (rides: Ride[]) => void) {
  const q = query(
    collection(db, 'rides'),
    where('status', '==', 'requested'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  
  return onSnapshot(
    q, 
    (snapshot) => {
      const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
      callback(rides);
    },
    (error) => handleFirestoreError(error, 'list', 'rides')
  );
}

export function subscribeToUserRides(uid: string, role: UserRole, callback: (rides: Ride[]) => void) {
  const field = role === 'passenger' ? 'passengerId' : 'riderId';
  const q = query(
    collection(db, 'rides'),
    where(field, '==', uid),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  
  return onSnapshot(
    q, 
    (snapshot) => {
      const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
      callback(rides);
    },
    (error) => handleFirestoreError(error, 'list', 'rides')
  );
}

export function subscribeToOnlineRiders(callback: (riders: UserProfile[]) => void) {
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'rider'),
    where('isOnline', '==', true)
  );
  
  return onSnapshot(
    q, 
    (snapshot) => {
      callback(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    },
    (error) => handleFirestoreError(error, 'list', 'users')
  );
}
// Saved Locations Functions
export async function saveLocation(uid: string, location: Omit<SavedLocation, 'id'>): Promise<void> {
  try {
    const user = doc(db, 'users', uid);
    const userDoc = await getDoc(user);
    
    if (!userDoc.exists()) throw new Error('User not found');
    
    const newLocation: SavedLocation = {
      id: `${Date.now()}`,
      ...location,
      createdAt: new Date().toISOString()
    };
    
    await updateDoc(user, {
      savedLocations: arrayUnion(newLocation),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    return handleFirestoreError(error, 'update', `users/${uid}/savedLocations`);
  }
}

export async function removeSavedLocation(uid: string, locationId: string): Promise<void> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) throw new Error('User not found');
    
    const currentLocations = (userDoc.data().savedLocations || []) as SavedLocation[];
    const locationToRemove = currentLocations.find(loc => loc.id === locationId);
    
    if (locationToRemove) {
      await updateDoc(doc(db, 'users', uid), {
        savedLocations: arrayRemove(locationToRemove)
      });
    }
  } catch (error) {
    return handleFirestoreError(error, 'update', `users/${uid}/savedLocations`);
  }
}

// Driver Status Functions
export async function updateDriverStatus(uid: string, status: 'active' | 'inactive' | 'riding'): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    return handleFirestoreError(error, 'update', `users/${uid}`);
  }
}

// Get nearby drivers by radius
export async function getNearbyDrivers(
  passengerLat: number,
  passengerLng: number,
  radiusInKm: number = 5
): Promise<UserProfile[]> {
  try {
    // Get all active drivers
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'rider'),
      where('isOnline', '==', true),
      where('status', '==', 'active')
    );
    
    const snapshot = await getDocs(q);
    const drivers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
    
    // Filter by distance
    return drivers.filter(driver => {
      if (!driver.currentLocation) return false;
      
      const latDiff = Math.abs(driver.currentLocation.lat - passengerLat);
      const lngDiff = Math.abs(driver.currentLocation.lng - passengerLng);
      const distanceInKm = Math.sqrt(Math.pow(latDiff, 2) + Math.pow(lngDiff, 2)) * 111;
      
      return distanceInKm <= radiusInKm;
    });
  } catch (error) {
    return handleFirestoreError(error, 'list', 'users');
  }
}