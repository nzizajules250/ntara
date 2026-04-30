const BASE_DISTANCE_KM = 2;
const BASE_FARE_RWF = 400;
const MID_DISTANCE_LIMIT_KM = 40;
const MID_DISTANCE_RATE_RWF = 117;
const LONG_DISTANCE_RATE_RWF = 205;

export interface FareBreakdown {
  distanceKm: number;
  roundedDistanceKm: number;
  fareRwf: number;
}

export function calculateRideFare(distanceMeters: number): FareBreakdown {
  const safeDistanceMeters = Number.isFinite(distanceMeters) ? Math.max(0, distanceMeters) : 0;
  const distanceKm = safeDistanceMeters / 1000;
  let fareRwf = 0;

  if (distanceKm > 0) {
    fareRwf += BASE_FARE_RWF;

    if (distanceKm > BASE_DISTANCE_KM) {
      const middleBandKm = Math.min(distanceKm, MID_DISTANCE_LIMIT_KM) - BASE_DISTANCE_KM;
      fareRwf += middleBandKm * MID_DISTANCE_RATE_RWF;
    }

    if (distanceKm > MID_DISTANCE_LIMIT_KM) {
      fareRwf += (distanceKm - MID_DISTANCE_LIMIT_KM) * LONG_DISTANCE_RATE_RWF;
    }
  }

  return {
    distanceKm,
    roundedDistanceKm: Number(distanceKm.toFixed(1)),
    fareRwf: Math.round(fareRwf)
  };
}

export function formatRwf(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `Rwf ${new Intl.NumberFormat('en-RW').format(safeAmount)}`;
}

export function formatDistanceKm(distanceMeters: number): string {
  const safeDistanceMeters = Number.isFinite(distanceMeters) ? Math.max(0, distanceMeters) : 0;
  const distanceKm = safeDistanceMeters / 1000;
  return `${distanceKm.toFixed(1)} km`;
}
