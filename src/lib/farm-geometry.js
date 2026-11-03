const earthRadiusMeters = 6371008.8;
export const squareMetersPerAcre = 4046.8564224;

function distanceBetweenPoints([latitudeA, longitudeA], [latitudeB, longitudeB]) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function calculateFieldAreaSquareMeters(points) {
  const area = points.reduce((total, [latitude, longitude], index) => {
    const [nextLatitude, nextLongitude] = points[(index + 1) % points.length];
    return total + (nextLongitude - longitude) * Math.PI / 180
      * (2 + Math.sin(latitude * Math.PI / 180) + Math.sin(nextLatitude * Math.PI / 180));
  }, 0);
  return Math.abs(area * earthRadiusMeters ** 2 / 2);
}

export function calculateFieldPerimeterMeters(points) {
  return points.reduce((total, point, index) => (
    total + distanceBetweenPoints(point, points[(index + 1) % points.length])
  ), 0);
}

export function formatFarmCoordinate(value, isLatitude) {
  return `${Math.abs(Number(value)).toFixed(5)}° ${Number(value) < 0 ? (isLatitude ? 'S' : 'W') : (isLatitude ? 'N' : 'E')}`;
}

export function createFieldGeoJson(field, boundary) {
  return {
    type: 'FeatureCollection',
    features: boundary ? [{
      type: 'Feature',
      properties: {
        id: field.id,
        name: field.name,
        crop: field.crop,
        areaAcres: field.area,
        plantingDate: field.plantedOn || '',
        season: field.season || '',
        boundaryStatus: 'saved locally; not independently verified',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          ...boundary.points.map(([latitude, longitude]) => [Number(longitude), Number(latitude)]),
          [Number(boundary.points[0][1]), Number(boundary.points[0][0])],
        ]],
      },
    }] : [],
  };
}
