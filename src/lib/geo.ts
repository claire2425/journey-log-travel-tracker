export type Coordinate = [longitude: number, latitude: number];

const degreesToRadians = (value: number) => (value * Math.PI) / 180;
const radiansToDegrees = (value: number) => (value * 180) / Math.PI;

function normaliseLongitude(value: number) {
  return ((value + 540) % 360) - 180;
}

/**
 * Returns points along the shorter great-circle path between two locations.
 * This is a visual route, not a navigation or distance-calculation service.
 */
export function interpolateGreatCircle(origin: Coordinate, destination: Coordinate, segments = 36): Coordinate[] {
  const [originLongitude, originLatitude] = origin;
  const [destinationLongitude, destinationLatitude] = destination;
  const originLat = degreesToRadians(originLatitude);
  const originLon = degreesToRadians(originLongitude);
  const destinationLat = degreesToRadians(destinationLatitude);
  const destinationLon = degreesToRadians(destinationLongitude);
  const cosineDistance = Math.sin(originLat) * Math.sin(destinationLat)
    + Math.cos(originLat) * Math.cos(destinationLat) * Math.cos(destinationLon - originLon);
  const angularDistance = Math.acos(Math.max(-1, Math.min(1, cosineDistance)));

  if (angularDistance < 0.000001) return [origin, destination];

  const pointCount = Math.max(1, Math.round(segments));
  const sineDistance = Math.sin(angularDistance);
  const points: Coordinate[] = [];

  for (let index = 0; index <= pointCount; index += 1) {
    if (index === 0) {
      points.push(origin);
      continue;
    }
    if (index === pointCount) {
      points.push(destination);
      continue;
    }
    const fraction = index / pointCount;
    const originWeight = Math.sin((1 - fraction) * angularDistance) / sineDistance;
    const destinationWeight = Math.sin(fraction * angularDistance) / sineDistance;
    const x = originWeight * Math.cos(originLat) * Math.cos(originLon) + destinationWeight * Math.cos(destinationLat) * Math.cos(destinationLon);
    const y = originWeight * Math.cos(originLat) * Math.sin(originLon) + destinationWeight * Math.cos(destinationLat) * Math.sin(destinationLon);
    const z = originWeight * Math.sin(originLat) + destinationWeight * Math.sin(destinationLat);
    const latitude = Math.atan2(z, Math.sqrt(x * x + y * y));
    const longitude = Math.atan2(y, x);
    points.push([normaliseLongitude(radiansToDegrees(longitude)), radiansToDegrees(latitude)]);
  }

  return points;
}
