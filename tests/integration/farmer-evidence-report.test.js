const { expect } = require('chai');

describe('farmer evidence summary', () => {
  const input = {
    profile: {
      name: 'Neema Farmer',
      region: 'Iringa',
      latitude: '-7.77',
      longitude: '35.69',
      nidaLast4: '1234',
      bankAccounts: [{ bank: 'CRDB', holder: 'Neema Farmer', last4: '4291' }],
    },
    records: {
      fields: [{ name: 'North field', crop: 'Maize', area: '2.5' }],
      activities: [{
        module: 'activity',
        category: 'Planting',
        date: '2026-03-01T10:00:00.000Z',
        photo: 'data:image/jpeg;base64,private-photo',
        photoAddedAt: '2026-03-01T10:01:00.000Z',
        gpsStamp: { latitude: -7.78, longitude: 35.7, accuracy: 10, stampedAt: '2026-03-01T10:02:00.000Z' },
      }],
      groups: [{ name: 'Iringa Farmers', region: 'Iringa' }],
    },
  };

  it('omits identity and precise coordinates unless the user opts in', async () => {
    const { buildFarmerEvidenceReport } = await import('../../src/lib/farmer-evidence-report.js');
    const report = buildFarmerEvidenceReport({
      ...input,
      options: { includeFarmDetails: true, includeActivitySummary: true },
    });
    const serialized = JSON.stringify(report);

    expect(report).not.to.have.property('farmer');
    expect(report).not.to.have.property('farmLocation');
    expect(report.farmActivities[0]).not.to.have.property('gpsLatitude');
    expect(report.recordCounts).not.to.have.property('groupRecords');
    expect(serialized).not.to.include('1234');
    expect(serialized).not.to.include('4291');
    expect(serialized).not.to.include('private-photo');
    expect(serialized).not.to.include('-7.78');
    expect(report.recordCounts.activitiesWithGpsStamp).to.equal(1);
  });

  it('includes exact location only with explicit consent and always excludes sensitive identifiers', async () => {
    const { buildFarmerEvidenceReport } = await import('../../src/lib/farmer-evidence-report.js');
    const report = buildFarmerEvidenceReport({
      ...input,
      options: { includeIdentity: true, includeLocation: true, includeActivitySummary: true },
    });
    const serialized = JSON.stringify(report);

    expect(report.farmer.name).to.equal('Neema Farmer');
    expect(report.farmLocation.latitude).to.equal('-7.77');
    expect(report.farmActivities[0].gpsLatitude).to.equal(-7.78);
    expect(serialized).not.to.include('1234');
    expect(serialized).not.to.include('4291');
    expect(serialized).not.to.include('CRDB');
    expect(report.profileCompleteness.notice).to.include('not a credit score');
  });
});
