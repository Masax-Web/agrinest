const { expect } = require('chai');

describe('saved farm boundary geometry', () => {
  it('calculates polygon area and closed perimeter from GPS vertices', async () => {
    const {
      calculateFieldAreaSquareMeters,
      calculateFieldPerimeterMeters,
    } = await import('../../src/lib/farm-geometry.js');
    const points = [[0, 0], [0, 0.001], [0.001, 0.001], [0.001, 0]];

    expect(calculateFieldAreaSquareMeters(points)).to.be.closeTo(12364, 20);
    expect(calculateFieldPerimeterMeters(points)).to.be.closeTo(444.8, 1);
  });

  it('exports GeoJSON coordinates in longitude-latitude order and closes the ring', async () => {
    const { createFieldGeoJson, formatFarmCoordinate } = await import('../../src/lib/farm-geometry.js');
    const boundary = { points: [[-7.77, 35.69], [-7.77, 35.70], [-7.78, 35.70]] };
    const geoJson = createFieldGeoJson({ id: 'field-1', name: 'North', crop: 'Maize' }, boundary);
    const coordinates = geoJson.features[0].geometry.coordinates[0];

    expect(coordinates[0]).to.deep.equal([35.69, -7.77]);
    expect(coordinates.at(-1)).to.deep.equal(coordinates[0]);
    expect(geoJson.features[0].properties.boundaryStatus).to.include('not independently verified');
    expect(formatFarmCoordinate(-7.77, true)).to.equal('7.77000° S');
    expect(formatFarmCoordinate(-35.69, false)).to.equal('35.69000° W');
  });
});
