const { expect } = require('chai');
const FarmService = require('../../api/generated/server/nodejs-express/services/FarmService');
const FarmOperations = require('../../api/services/FarmOperations');

async function expectError(promise, message) {
  try {
    await promise;
    throw new Error('Expected the operation to fail.');
  } catch (error) {
    expect(error.message).to.equal(message);
  }
}

describe('farm location evidence', () => {
  it('calculates distance for the 50 m proximity review radius', () => {
    const origin = { latitude: -6.8, longitude: 39.28 };
    const pointAbout40MetersNorth = { latitude: -6.8 + (40 / 6371000) * (180 / Math.PI), longitude: 39.28 };
    const pointAbout60MetersNorth = { latitude: -6.8 + (60 / 6371000) * (180 / Math.PI), longitude: 39.28 };
    expect(FarmService.distanceBetweenCoordinates(origin, pointAbout40MetersNorth)).to.be.closeTo(40, 0.1);
    expect(FarmService.distanceBetweenCoordinates(origin, pointAbout60MetersNorth)).to.be.closeTo(60, 0.1);
  });

  it('requires recent device GPS with accuracy within 50 m', () => {
    const capturedAt = new Date().toISOString();
    expect(FarmService.normalizeLocation({
      latitude: -6.8,
      longitude: 39.28,
      accuracy_m: 25,
      captured_at: capturedAt,
    })).to.include({ latitude: -6.8, longitude: 39.28, accuracy_m: 25 });

    expect(() => FarmService.normalizeLocation({
      latitude: -6.8,
      longitude: 39.28,
      accuracy_m: 51,
      captured_at: capturedAt,
    })).to.throw('farm_location_accuracy_too_low');
    expect(() => FarmService.normalizeLocation({
      latitude: -6.8,
      longitude: 39.28,
      accuracy_m: 25,
      captured_at: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
    })).to.throw('farm_location_stamp_expired');
  });

  it('requires an image and computes its evidence hash', () => {
    const location = {
      latitude: -6.8,
      longitude: 39.28,
      accuracy_m: 25,
      captured_at: new Date().toISOString(),
    };
    const evidence = FarmService.normalizeLocationEvidence({
      name: 'farm.jpg',
      mime_type: 'image/jpeg',
      data_url: 'data:image/jpeg;base64,ZmFrZQ==',
      captured_at: new Date().toISOString(),
    }, location);
    expect(evidence.sha256).to.be.a('string').with.length(64);
    expect(() => FarmService.normalizeLocationEvidence(null, location)).to.throw('farm_location_photo_required');
  });

  it('requires current GPS and photo evidence for finalized activity logs', async () => {
    const base = {
      farmId: '00000000-0000-4000-8000-000000000201',
      actorId: '00000000-0000-4000-8000-000000000101',
      activityDate: new Date().toISOString().slice(0, 10),
      crop: 'Maize',
      activityType: 'Planting',
      details: {},
    };
    await expectError(FarmOperations.createFarmActivityLog(base), 'activity_location_required');

    await expectError(FarmOperations.createFarmActivityLog({
      ...base,
      location: {
        latitude: -6.8,
        longitude: 39.28,
        accuracy_m: 20,
        captured_at: new Date().toISOString(),
      },
    }), 'activity_evidence_required');
  });
});
