const CATEGORY_WEIGHTS = {
  identity: 0.3,
  farm: 0.35,
  finance: 0.2,
  farmerRecord: 0.15,
};

function isPresent(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function percentFromChecks(checks) {
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function calculateFarmerTrust(profile = {}) {
  const bankAccounts = Array.isArray(profile.bankAccounts)
    ? profile.bankAccounts.filter((account) => (
      isPresent(account.bank)
      && isPresent(account.holder)
      && String(account.last4 || '').replace(/\D/g, '').length === 4
    ))
    : [];
  const crops = String(profile.crops || '').split(',').map((crop) => crop.trim()).filter(Boolean);
  const yearsFarming = Number(profile.yearsFarming);

  const categories = [
    {
      key: 'identity',
      label: 'Identity & contact',
      percent: percentFromChecks([
        isPresent(profile.name),
        String(profile.phone || '').replace(/\D/g, '').length >= 9,
        isPresent(profile.location),
        isPresent(profile.nidaLast4),
      ]),
    },
    {
      key: 'farm',
      label: 'Farm record',
      percent: percentFromChecks([
        isPresent(profile.farm),
        Number(profile.farmSize) > 0,
        crops.length > 0,
        profile.livestock !== '' && profile.livestock !== null && profile.livestock !== undefined,
        isPresent(profile.landTenure),
        Number.isFinite(Number(profile.latitude)) && isPresent(profile.latitude)
          && Number.isFinite(Number(profile.longitude)) && isPresent(profile.longitude),
      ]),
    },
    {
      key: 'finance',
      label: 'Bank accounts',
      percent: Math.min(bankAccounts.length, 2) * 50,
    },
    {
      key: 'farmerRecord',
      label: 'Farmer experience',
      percent: percentFromChecks([
        Number.isFinite(yearsFarming) && yearsFarming > 0,
        isPresent(profile.cooperative),
        isPresent(profile.irrigation),
        isPresent(profile.certifications),
      ]),
    },
  ];

  const score = Math.round(categories.reduce(
    (total, category) => total + category.percent * CATEGORY_WEIGHTS[category.key] * 10,
    0,
  ));

  return {
    score,
    tier: score >= 800 ? 'Complete' : score >= 550 ? 'Developing' : 'Getting started',
    categories,
  };
}