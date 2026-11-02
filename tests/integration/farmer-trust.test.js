const { expect } = require('chai');

describe('farmer profile trust score', () => {
  it('starts at zero when there are no farmer profile details', async () => {
    const { calculateFarmerTrust } = await import('../../src/lib/farmer-trust.js');

    expect(calculateFarmerTrust().score).to.equal(0);
  });

  it('increases from saved identity, farm, finance, and farmer records', async () => {
    const { calculateFarmerTrust } = await import('../../src/lib/farmer-trust.js');
    const profile = {
      name: 'Neema Mwangi',
      phone: '+255 712 345 678',
      location: 'Iringa, Tanzania',
      nidaLast4: '1234',
      farm: 'Mtakuja Farm',
      farmSize: '3.5',
      crops: 'Maize, Beans',
      livestock: '12',
      landTenure: 'Family-owned',
      latitude: '-7.77',
      longitude: '35.69',
      bankAccounts: [{ bank: 'CRDB', holder: 'Neema Mwangi', last4: '4291' }],
      yearsFarming: '8',
      cooperative: 'Iringa Women Farmers',
      irrigation: 'Drip',
      certifications: 'IPM training',
    };
    const score = calculateFarmerTrust(profile);

    expect(score.score).to.equal(900);
    expect(score.categories.map((category) => category.percent)).to.deep.equal([100, 100, 50, 100]);
  });

  it('caps the bank-account contribution and does not mutate profile data', async () => {
    const { calculateFarmerTrust } = await import('../../src/lib/farmer-trust.js');
    const profile = { bankAccounts: [
      { bank: 'CRDB', holder: 'Farmer', last4: '4291' },
      { bank: 'NMB', holder: 'Farmer', last4: '8830' },
      { bank: 'NBC', holder: 'Farmer', last4: '0042' },
    ] };
    const score = calculateFarmerTrust(profile);
    const incomplete = calculateFarmerTrust({ bankAccounts: [{ bank: 'CRDB', last4: '4291' }] });

    expect(score.categories.find((category) => category.key === 'finance').percent).to.equal(100);
    expect(incomplete.categories.find((category) => category.key === 'finance').percent).to.equal(0);
    expect(profile.bankAccounts).to.have.length(3);
  });
});